import { GameDatabaseService, db } from './database.js';
import axios from 'axios';

const gameDb = new GameDatabaseService();
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'https://localhost:3001';
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'https://localhost:3003';

// Helper function to get user profile from user-service
async function getUserProfile(userId, token) {
    try {
        const response = await axios.get(`${USER_SERVICE_URL}/api/user/profile/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch user profile:', error.message);
        return null;
    }
}

// Helper function to check if users are blocked via chat-service
async function checkIfBlocked(user1Id, user2Id, token) {
    try {
        const response = await axios.get(`${CHAT_SERVICE_URL}/api/users/blocked`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const blockedUsers = response.data || [];
        return blockedUsers.some(blocked => 
            (blocked.blocker_id === user1Id && blocked.blocked_id === user2Id) ||
            (blocked.blocker_id === user2Id && blocked.blocked_id === user1Id)
        );
    } catch (error) {
        console.warn('Could not check blocked status:', error.message);
        return false;
    }
}

export default async function gameRoutes(fastify, options) {
    // Authentication decorator
    fastify.decorate('authenticate', async function(request, reply) {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });

    // ========================================
    // GAME SESSION ROUTES
    // ========================================

    // Create a new game session
    fastify.post('/api/game/session', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const userId = req.user.sub || req.user.user_id || req.user.id;
                const { player2_id, game_mode, tournament_id } = req.body;
                const token = req.headers.authorization;

                const validModes = ['local', 'remote', 'ai', 'tournament'];
                if (!validModes.includes(game_mode)) {
                    return reply.code(400).send({ error: 'Invalid game mode' });
                }

                if (game_mode === 'remote' && player2_id) {
                    const isBlocked = await checkIfBlocked(userId, player2_id, token);
                    if (isBlocked) {
                        return reply.code(403).send({ error: 'Cannot play with blocked user' });
                    }
                }

                const gameSession = await gameDb.createGameSession({
                    player1_id: userId,
                    player2_id: player2_id || null,
                    game_mode,
                    tournament_id,
                    status: 'waiting'
                });

                if (game_mode === 'remote') {
                    const roomId = `room_${gameSession.id}_${Date.now()}`;
                    await gameDb.createActiveGameRoom(roomId, gameSession.id);
                    gameSession.room_id = roomId;
                }

                reply.send({ success: true, game_session: gameSession });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to create game session' });
            }
        }
    });

    // Get game session details
    fastify.get('/api/game/session/:sessionId', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { sessionId } = req.params;
                const userId = req.user.sub || req.user.user_id || req.user.id;

                const gameSession = await gameDb.getGameSession(sessionId);
                if (!gameSession) {
                    return reply.code(404).send({ error: 'Game session not found' });
                }

                if (gameSession.player1_id !== userId && gameSession.player2_id !== userId) {
                    return reply.code(403).send({ error: 'Not authorized to view this game' });
                }

                reply.send({ success: true, game_session: gameSession });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch game session' });
            }
        }
    });

    // Update game session (enhanced with tournament advancement)
    fastify.patch('/api/game/session/:sessionId', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { sessionId } = req.params;
                const userId = req.user.sub || req.user.user_id || req.user.id;
                const updates = req.body;

                const gameSession = await gameDb.getGameSession(sessionId);
                if (!gameSession) {
                    return reply.code(404).send({ error: 'Game session not found' });
                }

                if (gameSession.player1_id !== userId && gameSession.player2_id !== userId) {
                    return reply.code(403).send({ error: 'Not authorized to update this game' });
                }

                const updatedSession = await gameDb.updateGameSession(sessionId, updates);
                
                // If game finished, update player statistics and handle tournament advancement
                if (updates.status === 'finished' && updates.winner_id) {
                    const player1Result = {
                        result: updates.winner_id === gameSession.player1_id ? 'won' : 'lost',
                        score: gameSession.player1_score,
                        duration: updates.game_duration
                    };
                    const player2Result = {
                        result: updates.winner_id === gameSession.player2_id ? 'won' : 'lost',
                        score: gameSession.player2_score,
                        duration: updates.game_duration
                    };

                    await gameDb.updatePlayerStats(gameSession.player1_id, player1Result);
                    if (gameSession.player2_id) {
                        await gameDb.updatePlayerStats(gameSession.player2_id, player2Result);
                    }

                    // Handle tournament advancement if this is a tournament game
                    if (gameSession.tournament_id) {
                        try {
                            // Find the tournament match for this game session
                            const matches = await gameDb.getTournamentMatches(gameSession.tournament_id);
                            const tournamentMatch = matches.find(m => m.game_session_id === parseInt(sessionId));
                            
                            if (tournamentMatch) {
                                await gameDb.advanceWinnerToNextRound(tournamentMatch.id, updates.winner_id);
                                
                                // Notify tournament participants about the result
                                const tournament = await gameDb.getTournament(gameSession.tournament_id);
                                const participants = await gameDb.getTournamentParticipants(gameSession.tournament_id);
                                
                                participants.forEach(participant => {
                                    fastify.io.to(`user_${participant.user_id}`).emit('tournament_match_result', {
                                        tournament_id: gameSession.tournament_id,
                                        match_id: tournamentMatch.id,
                                        winner_id: updates.winner_id,
                                        game_session: updatedSession
                                    });
                                });
                            }
                        } catch (error) {
                            req.log.error('Tournament advancement error:', error);
                        }
                    }
                }

                reply.send({ success: true, game_session: updatedSession });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to update game session' });
            }
        }
    });

    // Get player's game history
    fastify.get('/api/game/history', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const userId = req.user.sub || req.user.user_id || req.user.id;
                const { limit = 50, offset = 0 } = req.query;

                const history = await gameDb.getPlayerGameHistory(userId, limit, offset);
                reply.send({ success: true, games: history, count: history.length });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch game history' });
            }
        }
    });

    // ========================================
    // ENHANCED TOURNAMENT ROUTES
    // ========================================

    // Create a new tournament (enhanced with seeding options)
    fastify.post('/api/game/tournament', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const userId = req.user.sub || req.user.user_id || req.user.id;
                const { 
                    name, 
                    description, 
                    max_players = 8, 
                    tournament_type = 'single_elimination',
                    seeding_method = 'random',
                    auto_advance_timer = 300
                } = req.body;

                if (!name || name.trim().length === 0) {
                    return reply.code(400).send({ error: 'Tournament name is required' });
                }

                const validSeedingMethods = ['random', 'ranking', 'manual'];
                if (!validSeedingMethods.includes(seeding_method)) {
                    return reply.code(400).send({ error: 'Invalid seeding method' });
                }

                const tournament = await gameDb.createTournament({
                    name: name.trim(),
                    description: description || '',
                    creator_id: userId,
                    max_players: Math.max(2, Math.min(64, max_players)),
                    tournament_type,
                    seeding_method,
                    auto_advance_timer: Math.max(60, Math.min(1800, auto_advance_timer)) // 1-30 minutes
                });

                reply.send({ success: true, tournament });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to create tournament' });
            }
        }
    });

    // Get tournament details (enhanced with announcements)
    fastify.get('/api/game/tournament/:tournamentId', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { tournamentId } = req.params;
                const userId = req.user.sub || req.user.user_id || req.user.id;
                
                const tournament = await gameDb.getTournament(tournamentId);
                if (!tournament) {
                    return reply.code(404).send({ error: 'Tournament not found' });
                }

                const participants = await gameDb.getTournamentParticipants(tournamentId);
                const matches = await gameDb.getTournamentMatches(tournamentId);
                const announcements = await gameDb.getTournamentAnnouncements(tournamentId, userId);

                reply.send({ 
                    success: true, 
                    tournament: { 
                        ...tournament, 
                        participants, 
                        matches, 
                        announcements 
                    }
                });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch tournament' });
            }
        }
    });

    // Join a tournament (enhanced)
    fastify.post('/api/game/tournament/:tournamentId/join', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { tournamentId } = req.params;
                const userId = req.user.sub || req.user.user_id || req.user.id;
                const token = req.headers.authorization;

                const userProfile = await getUserProfile(userId, token);
                if (!userProfile) {
                    return reply.code(400).send({ error: 'Could not fetch user profile' });
                }

                await gameDb.joinTournament(tournamentId, userId, userProfile.username || userProfile.display_name);
                
                const tournament = await gameDb.getTournament(tournamentId);
                const participants = await gameDb.getTournamentParticipants(tournamentId);

                // Notify all participants via socket
                participants.forEach(participant => {
                    fastify.io.to(`user_${participant.user_id}`).emit('tournament_player_joined', {
                        tournament_id: tournamentId,
                        new_player: userProfile,
                        current_players: tournament.current_players,
                        max_players: tournament.max_players
                    });
                });

                reply.send({ success: true, tournament, participants });
            } catch (error) {
                req.log.error(error);
                if (error.message.includes('already joined')) {
                    return reply.code(409).send({ error: error.message });
                }
                reply.code(500).send({ error: error.message || 'Failed to join tournament' });
            }
        }
    });

    // Apply seeding to tournament
    fastify.post('/api/game/tournament/:tournamentId/seeding', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { tournamentId } = req.params;
                const { seeding_method, manual_seeds } = req.body;
                const userId = req.user.sub || req.user.user_id || req.user.id;

                const tournament = await gameDb.getTournament(tournamentId);
                if (!tournament) {
                    return reply.code(404).send({ error: 'Tournament not found' });
                }

                if (tournament.creator_id !== userId) {
                    return reply.code(403).send({ error: 'Only tournament creator can manage seeding' });
                }

                if (tournament.status !== 'registration') {
                    return reply.code(400).send({ error: 'Cannot change seeding after tournament starts' });
                }

                let participants;
                if (seeding_method === 'manual' && manual_seeds) {
                    // Apply manual seeding
                    const promises = manual_seeds.map(({ user_id, seed_number }) => {
                        return new Promise((resolve, reject) => {
                            db.run(`
                                UPDATE tournament_participants 
                                SET seed_number = ? 
                                WHERE tournament_id = ? AND user_id = ?
                            `, [seed_number, tournamentId, user_id], (err) => {
                                if (err) return reject(err);
                                resolve();
                            });
                        });
                    });
                    await Promise.all(promises);
                    participants = await gameDb.getTournamentParticipants(tournamentId);
                } else {
                    participants = await gameDb.applySeeding(tournamentId, seeding_method);
                }

                // Notify participants about seeding
                participants.forEach(participant => {
                    fastify.io.to(`user_${participant.user_id}`).emit('tournament_seeding_updated', {
                        tournament_id: tournamentId,
                        participants
                    });
                });

                reply.send({ success: true, participants });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to apply seeding' });
            }
        }
    });

    // Start a tournament (enhanced)
    fastify.post('/api/game/tournament/:tournamentId/start', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { tournamentId } = req.params;
                const userId = req.user.sub || req.user.user_id || req.user.id;

                const tournament = await gameDb.getTournament(tournamentId);
                if (!tournament) {
                    return reply.code(404).send({ error: 'Tournament not found' });
                }

                if (tournament.creator_id !== userId) {
                    return reply.code(403).send({ error: 'Only tournament creator can start the tournament' });
                }

                const updatedTournament = await gameDb.startTournament(tournamentId);
                const participants = await gameDb.getTournamentParticipants(tournamentId);
                const matches = await gameDb.getTournamentMatches(tournamentId, 1);
                const announcements = await gameDb.getTournamentAnnouncements(tournamentId);

                // Notify all participants
                participants.forEach(participant => {
                    fastify.io.to(`user_${participant.user_id}`).emit('tournament_started', {
                        tournament: updatedTournament,
                        first_round_matches: matches,
                        announcements
                    });
                });

                // Create match ready announcements for first round
                for (const match of matches) {
                    if (match.status === 'ready' && match.player1_id && match.player2_id) {
                        await gameDb.createMatchReadyAnnouncement(
                            tournamentId, 
                            match.id, 
                            [match.player1_id, match.player2_id]
                        );
                    }
                }

                reply.send({ 
                    success: true, 
                    tournament: updatedTournament, 
                    matches,
                    announcements
                });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: error.message || 'Failed to start tournament' });
            }
        }
    });

    // Get tournament bracket/matches (enhanced)
    fastify.get('/api/game/tournament/:tournamentId/matches', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { tournamentId } = req.params;
                const { round } = req.query;

                const matches = await gameDb.getTournamentMatches(tournamentId, round);
                
                // Group matches by round for better bracket visualization
                const groupedMatches = matches.reduce((acc, match) => {
                    if (!acc[match.round_number]) {
                        acc[match.round_number] = [];
                    }
                    acc[match.round_number].push(match);
                    return acc;
                }, {});

                reply.send({ 
                    success: true, 
                    matches,
                    grouped_matches: groupedMatches,
                    total_rounds: Math.max(...matches.map(m => m.round_number), 0)
                });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch tournament matches' });
            }
        }
    });

    // Get active tournaments (enhanced)
    fastify.get('/api/game/tournaments', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { status = 'registration', limit = 20, offset = 0 } = req.query;
                
                const tournaments = await new Promise((resolve, reject) => {
                    const stmt = db.prepare(`
                        SELECT t.*, 
                               COUNT(tp.user_id) as current_players
                        FROM tournaments t
                        LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
                        WHERE t.status = ?
                        GROUP BY t.id
                        ORDER BY t.created_at DESC
                        LIMIT ? OFFSET ?
                    `);
                    
                    stmt.all(status, limit, offset, (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows);
                    });
                    stmt.finalize();
                });
                
                reply.send({ success: true, tournaments });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch tournaments' });
            }
        }
    });

    // ========================================
    // TOURNAMENT ANNOUNCEMENTS
    // ========================================

    // Get tournament announcements
    fastify.get('/api/game/tournament/:tournamentId/announcements', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { tournamentId } = req.params;
                const { unread_only } = req.query;
                const userId = req.user.sub || req.user.user_id || req.user.id;

                const announcements = await gameDb.getTournamentAnnouncements(
                    tournamentId, 
                    userId, 
                    unread_only === 'true'
                );

                reply.send({ success: true, announcements });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch announcements' });
            }
        }
    });

    // Mark announcement as read
    fastify.post('/api/game/announcement/:announcementId/read', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { announcementId } = req.params;
                const userId = req.user.sub || req.user.user_id || req.user.id;

                await gameDb.markAnnouncementAsRead(announcementId, userId);
                reply.send({ success: true });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to mark announcement as read' });
            }
        }
    });

    // Create custom tournament announcement (creator only)
    fastify.post('/api/game/tournament/:tournamentId/announcement', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { tournamentId } = req.params;
                const { title, message, target_users, priority = 1 } = req.body;
                const userId = req.user.sub || req.user.user_id || req.user.id;

                const tournament = await gameDb.getTournament(tournamentId);
                if (!tournament) {
                    return reply.code(404).send({ error: 'Tournament not found' });
                }

                if (tournament.creator_id !== userId) {
                    return reply.code(403).send({ error: 'Only tournament creator can create announcements' });
                }

                const announcement = await gameDb.createAnnouncement(tournamentId, {
                    type: 'general',
                    title,
                    message,
                    target_users: target_users ? JSON.stringify(target_users) : null,
                    priority,
                    created_by: userId
                });

                // Notify relevant participants
                const participants = await gameDb.getTournamentParticipants(tournamentId);
                const targetParticipants = target_users ? 
                    participants.filter(p => target_users.includes(p.user_id)) : 
                    participants;

                targetParticipants.forEach(participant => {
                    fastify.io.to(`user_${participant.user_id}`).emit('tournament_announcement', {
                        tournament_id: tournamentId,
                        announcement
                    });
                });

                reply.send({ success: true, announcement });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to create announcement' });
            }
        }
    });

    // ========================================
    // GAME INVITATIONS
    // ========================================

    // Send game invitation
    fastify.post('/api/game/invite', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const senderId = req.user.sub || req.user.user_id || req.user.id;
                const { receiver_id, game_mode, message, tournament_id } = req.body;
                const token = req.headers.authorization;

                if (!receiver_id) {
                    return reply.code(400).send({ error: 'Receiver ID is required' });
                }

                if (senderId === receiver_id) {
                    return reply.code(400).send({ error: 'Cannot invite yourself' });
                }

                const isBlocked = await checkIfBlocked(senderId, receiver_id, token);
                if (isBlocked) {
                    return reply.code(403).send({ error: 'Cannot send invitation to blocked user' });
                }

                const senderProfile = await getUserProfile(senderId, token);
                if (!senderProfile) {
                    return reply.code(400).send({ error: 'Could not fetch sender profile' });
                }

                const invitation = await gameDb.sendGameInvitation({
                    sender_id: senderId,
                    receiver_id: receiver_id,
                    game_mode: game_mode || 'remote',
                    tournament_id,
                    message: message || `${senderProfile.username} invites you to play Pong!`
                });

                fastify.io.to(`user_${receiver_id}`).emit('game_invitation', {
                    invitation,
                    sender: senderProfile,
                    message: invitation.message
                });

                reply.send({ success: true, invitation });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: error.message || 'Failed to send invitation' });
            }
        }
    });

    // Respond to game invitation
    fastify.post('/api/game/invite/:invitationId/respond', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { invitationId } = req.params;
                const { response } = req.body;
                const userId = req.user.sub || req.user.user_id || req.user.id;
                const token = req.headers.authorization;

                if (!['accepted', 'declined'].includes(response)) {
                    return reply.code(400).send({ error: 'Response must be "accepted" or "declined"' });
                }

                const updatedInvitation = await gameDb.respondToGameInvitation(invitationId, response, userId);
                
                const userProfile = await getUserProfile(userId, token);
                
                fastify.io.to(`user_${updatedInvitation.sender_id}`).emit('game_invitation_response', {
                    invitation: updatedInvitation,
                    responder: userProfile,
                    response
                });

                if (response === 'accepted') {
                    const gameSession = await gameDb.createGameSession({
                        player1_id: updatedInvitation.sender_id,
                        player2_id: userId,
                        game_mode: updatedInvitation.game_mode,
                        tournament_id: updatedInvitation.tournament_id,
                        status: 'waiting'
                    });

                    const roomId = `room_${gameSession.id}_${Date.now()}`;
                    await gameDb.createActiveGameRoom(roomId, gameSession.id);

                    const gameData = {
                        game_session: gameSession,
                        room_id: roomId
                    };

                    fastify.io.to(`user_${updatedInvitation.sender_id}`).emit('game_ready', gameData);
                    fastify.io.to(`user_${userId}`).emit('game_ready', gameData);
                }

                reply.send({ success: true, invitation: updatedInvitation });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: error.message || 'Failed to respond to invitation' });
            }
        }
    });

    // Get user's game invitations
    fastify.get('/api/game/invitations', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const userId = req.user.sub || req.user.user_id || req.user.id;
                const { status } = req.query;

                const invitations = await gameDb.getUserGameInvitations(userId, status);
                reply.send({ success: true, invitations });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch invitations' });
            }
        }
    });

    // ========================================
    // PLAYER STATISTICS ROUTES
    // ========================================

    // Get player statistics
    fastify.get('/api/game/stats', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const userId = req.user.sub || req.user.user_id || req.user.id;
                const stats = await gameDb.getOrCreatePlayerStats(userId);
                
                const winRate = stats.total_games > 0 ? 
                    Math.round((stats.wins / stats.total_games) * 100) : 0;
                
                reply.send({ 
                    success: true, 
                    stats: { ...stats, win_rate: winRate }
                });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch statistics' });
            }
        }
    });

    // Get player statistics by user ID
    fastify.get('/api/game/stats/:userId', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { userId } = req.params;
                const stats = await gameDb.getOrCreatePlayerStats(userId);
                
                const winRate = stats.total_games > 0 ? 
                    Math.round((stats.wins / stats.total_games) * 100) : 0;
                
                reply.send({ 
                    success: true, 
                    stats: { ...stats, win_rate: winRate }
                });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch statistics' });
            }
        }
    });

    // Get leaderboard
    fastify.get('/api/game/leaderboard', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { limit = 100 } = req.query;
                const leaderboard = await gameDb.getLeaderboard(limit);
                
                reply.send({ success: true, leaderboard });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch leaderboard' });
            }
        }
    });

    // ========================================
    // GAME ROOM ROUTES
    // ========================================

    // Join game room
    fastify.post('/api/game/room/:roomId/join', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { roomId } = req.params;
                const userId = req.user.sub || req.user.user_id || req.user.id;

                const room = await gameDb.getActiveGameRoom(roomId);
                if (!room) {
                    return reply.code(404).send({ error: 'Game room not found' });
                }

                const gameSession = await gameDb.getGameSession(room.game_session_id);
                if (!gameSession) {
                    return reply.code(404).send({ error: 'Game session not found' });
                }

                if (gameSession.player1_id !== userId && gameSession.player2_id !== userId) {
                    return reply.code(403).send({ error: 'Not authorized to join this game' });
                }

                reply.send({ 
                    success: true, 
                    room, 
                    game_session: gameSession 
                });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to join game room' });
            }
        }
    });

    // Record game event
    fastify.post('/api/game/session/:sessionId/event', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { sessionId } = req.params;
                const eventData = req.body;
                const userId = req.user.sub || req.user.user_id || req.user.id;

                const gameSession = await gameDb.getGameSession(sessionId);
                if (!gameSession) {
                    return reply.code(404).send({ error: 'Game session not found' });
                }

                if (gameSession.player1_id !== userId && gameSession.player2_id !== userId) {
                    return reply.code(403).send({ error: 'Not authorized' });
                }

                await gameDb.recordGameEvent(sessionId, {
                    ...eventData,
                    player_id: userId,
                    timestamp_ms: Date.now()
                });

                reply.send({ success: true });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to record game event' });
            }
        }
    });

    // Get game events
    fastify.get('/api/game/session/:sessionId/events', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const { sessionId } = req.params;
                const userId = req.user.sub || req.user.user_id || req.user.id;

                const gameSession = await gameDb.getGameSession(sessionId);
                if (!gameSession) {
                    return reply.code(404).send({ error: 'Game session not found' });
                }

                if (gameSession.player1_id !== userId && gameSession.player2_id !== userId) {
                    return reply.code(403).send({ error: 'Not authorized' });
                }

                const events = await gameDb.getGameEvents(sessionId);
                reply.send({ success: true, events });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Failed to fetch game events' });
            }
        }
    });

    // ========================================
    // UTILITY ROUTES
    // ========================================

    // Health check
    fastify.get('/api/game/health', async (req, reply) => {
        reply.send({ 
            status: 'ok', 
            service: 'pong-game-service',
            timestamp: new Date().toISOString()
        });
    });

    // Clean up expired data (enhanced)
    fastify.post('/api/game/admin/cleanup', {
        preHandler: fastify.authenticate,
        handler: async (req, reply) => {
            try {
                const expiredInvitations = await gameDb.cleanupExpiredInvitations();
                const expiredAnnouncements = await gameDb.cleanupExpiredAnnouncements();
                const oldRooms = await gameDb.cleanupOldGameRooms();
                
                reply.send({ 
                    success: true, 
                    cleanup: {
                        expired_invitations: expiredInvitations,
                        expired_announcements: expiredAnnouncements,
                        old_rooms: oldRooms
                    }
                });
            } catch (error) {
                req.log.error(error);
                reply.code(500).send({ error: 'Cleanup failed' });
            }
        }
    });
}