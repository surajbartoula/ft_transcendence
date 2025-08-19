import { GameDatabaseService, db } from './database.js';

const gameDb = new GameDatabaseService();

// Game state management for active games
const activeGames = new Map();
const tournamentRooms = new Map(); // Track tournament spectators

export function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Player connected: ${socket.id}`);
        
        let currentUser = null;
        let currentRoom = null;
        let currentGameSession = null;
        let currentTournamentId = null;

        // ========================================
        // AUTHENTICATION & USER MANAGEMENT
        // ========================================

        socket.on('authenticate', async (data) => {
            try {
                const { user_id, username } = data;
                currentUser = { user_id, username };
                
                // Join user-specific room for notifications
                await socket.join(`user_${user_id}`);
                
                console.log(`✅ User authenticated: ${username} (${user_id})`);
                socket.emit('authenticated', { success: true, user: currentUser });
            } catch (error) {
                console.error('Authentication error:', error);
                socket.emit('auth_error', { error: 'Authentication failed' });
            }
        });

        // ========================================
        // GAME ROOM MANAGEMENT (enhanced)
        // ========================================

        socket.on('join_game_room', async (data) => {
            try {
                const { room_id, game_session_id } = data;
                
                if (!currentUser) {
                    return socket.emit('error', { error: 'Not authenticated' });
                }

                const gameSession = await gameDb.getGameSession(game_session_id);
                if (!gameSession) {
                    return socket.emit('error', { error: 'Game session not found' });
                }

                const isPlayer = gameSession.player1_id === currentUser.user_id || 
                                gameSession.player2_id === currentUser.user_id;
                
                if (!isPlayer) {
                    return socket.emit('error', { error: 'Not authorized to join this game' });
                }

                await socket.join(room_id);
                currentRoom = room_id;
                currentGameSession = gameSession;

                // If this is a tournament game, also join tournament room
                if (gameSession.tournament_id) {
                    currentTournamentId = gameSession.tournament_id;
                    await socket.join(`tournament_${gameSession.tournament_id}`);
                }

                const isPlayer1 = gameSession.player1_id === currentUser.user_id;
                const updateData = {};
                updateData[isPlayer1 ? 'player1_socket_id' : 'player2_socket_id'] = socket.id;
                updateData.last_activity = new Date().toISOString();

                await gameDb.updateGameRoom(room_id, updateData);

                if (!activeGames.has(room_id)) {
                    activeGames.set(room_id, {
                        gameSession,
                        players: {},
                        gameState: {
                            ball: { x: 400, y: 300, vx: 5, vy: 3 },
                            paddle1: { y: 250, score: 0 },
                            paddle2: { y: 250, score: 0 },
                            isRunning: false,
                            isPaused: false,
                            lastUpdate: Date.now()
                        },
                        spectators: []
                    });
                }

                const gameData = activeGames.get(room_id);
                gameData.players[currentUser.user_id] = {
                    socket_id: socket.id,
                    username: currentUser.username,
                    is_player1: isPlayer1,
                    ready: false
                };

                console.log(`🎮 Player ${currentUser.username} joined game room: ${room_id}`);
                
                socket.to(room_id).emit('player_joined', {
                    user: currentUser,
                    players_count: Object.keys(gameData.players).length
                });

                // If tournament game, notify tournament room about active match
                if (gameSession.tournament_id) {
                    socket.to(`tournament_${gameSession.tournament_id}`).emit('tournament_match_started', {
                        game_session_id: game_session_id,
                        room_id: room_id,
                        players: [
                            { id: gameSession.player1_id, is_ready: false },
                            { id: gameSession.player2_id, is_ready: false }
                        ]
                    });
                }

                socket.emit('game_state', {
                    room_id,
                    game_session: gameSession,
                    game_state: gameData.gameState,
                    players: gameData.players,
                    your_role: isPlayer1 ? 'player1' : 'player2'
                });

            } catch (error) {
                console.error('Join room error:', error);
                socket.emit('error', { error: 'Failed to join game room' });
            }
        });

        socket.on('leave_game_room', () => {
            if (currentRoom && currentUser) {
                handlePlayerLeave();
            }
        });

        // ========================================
        // GAME CONTROL EVENTS (enhanced)
        // ========================================

        socket.on('player_ready', async () => {
            if (!currentRoom || !currentUser) return;

            const gameData = activeGames.get(currentRoom);
            if (!gameData || !gameData.players[currentUser.user_id]) return;

            gameData.players[currentUser.user_id].ready = true;
            
            const playerCount = Object.keys(gameData.players).length;
            const readyCount = Object.values(gameData.players).filter(p => p.ready).length;

            socket.to(currentRoom).emit('player_ready', {
                user: currentUser,
                ready_count: readyCount,
                total_players: playerCount
            });

            // Notify tournament room if applicable
            if (currentTournamentId) {
                socket.to(`tournament_${currentTournamentId}`).emit('tournament_player_ready', {
                    user: currentUser,
                    game_session_id: currentGameSession?.id,
                    ready_count: readyCount,
                    total_players: playerCount
                });
            }

            // Start game if both players are ready
            if (playerCount === 2 && readyCount === 2) {
                await startGame(currentRoom);
            }
        });

        socket.on('paddle_move', (data) => {
            if (!currentRoom || !currentUser) return;

            const gameData = activeGames.get(currentRoom);
            if (!gameData || !gameData.gameState.isRunning) return;

            const player = gameData.players[currentUser.user_id];
            if (!player) return;

            const { direction, y } = data;
            
            if (player.is_player1) {
                gameData.gameState.paddle1.y = Math.max(0, Math.min(500, y || gameData.gameState.paddle1.y));
                if (direction === 'up') gameData.gameState.paddle1.y -= 10;
                if (direction === 'down') gameData.gameState.paddle1.y += 10;
            } else {
                gameData.gameState.paddle2.y = Math.max(0, Math.min(500, y || gameData.gameState.paddle2.y));
                if (direction === 'up') gameData.gameState.paddle2.y -= 10;
                if (direction === 'down') gameData.gameState.paddle2.y += 10;
            }

            socket.to(currentRoom).emit('paddle_update', {
                player: player.is_player1 ? 'player1' : 'player2',
                y: player.is_player1 ? gameData.gameState.paddle1.y : gameData.gameState.paddle2.y
            });
        });

        socket.on('game_pause', async () => {
            if (!currentRoom || !currentUser) return;

            const gameData = activeGames.get(currentRoom);
            if (!gameData || !gameData.gameState.isRunning) return;

            gameData.gameState.isPaused = !gameData.gameState.isPaused;
            
            io.to(currentRoom).emit('game_paused', {
                paused_by: currentUser.username,
                is_paused: gameData.gameState.isPaused
            });

            if (currentGameSession) {
                try {
                    await gameDb.recordGameEvent(currentGameSession.id, {
                        event_type: gameData.gameState.isPaused ? 'pause' : 'resume',
                        player_id: currentUser.user_id,
                        timestamp_ms: Date.now()
                    });
                } catch (error) {
                    console.error('Error recording pause event:', error);
                }
            }
        });

        socket.on('game_quit', async () => {
            if (!currentRoom || !currentUser) return;

            const gameData = activeGames.get(currentRoom);
            if (!gameData) return;

            try {
                const otherPlayer = Object.values(gameData.players).find(p => p.socket_id !== socket.id);
                if (otherPlayer && currentGameSession) {
                    const winnerUserId = Object.keys(gameData.players).find(userId => 
                        gameData.players[userId].socket_id === otherPlayer.socket_id
                    );

                    await gameDb.updateGameSession(currentGameSession.id, {
                        winner_id: winnerUserId,
                        status: 'finished',
                        finished_at: new Date().toISOString(),
                        match_data: {
                            ...currentGameSession.match_data,
                            forfeit: true,
                            forfeit_by: currentUser.user_id
                        }
                    });

                    await gameDb.updatePlayerStats(currentUser.user_id, { result: 'lost', score: 0 });
                    await gameDb.updatePlayerStats(winnerUserId, { result: 'won', score: 0 });

                    // Handle tournament advancement if applicable
                    if (currentGameSession.tournament_id) {
                        try {
                            const matches = await gameDb.getTournamentMatches(currentGameSession.tournament_id);
                            const tournamentMatch = matches.find(m => m.game_session_id === currentGameSession.id);
                            
                            if (tournamentMatch) {
                                await gameDb.advanceWinnerToNextRound(tournamentMatch.id, winnerUserId);
                                
                                // Notify tournament room
                                io.to(`tournament_${currentGameSession.tournament_id}`).emit('tournament_match_result', {
                                    match_id: tournamentMatch.id,
                                    winner_id: winnerUserId,
                                    result_type: 'forfeit',
                                    forfeit_by: currentUser.user_id
                                });
                            }
                        } catch (error) {
                            console.error('Tournament advancement error:', error);
                        }
                    }
                }

                io.to(currentRoom).emit('game_ended', {
                    reason: 'forfeit',
                    forfeit_by: currentUser.username,
                    winner: otherPlayer?.username
                });

                cleanupGame(currentRoom);
            } catch (error) {
                console.error('Error handling game quit:', error);
            }
        });

        // ========================================
        // ENHANCED TOURNAMENT EVENTS
        // ========================================

        socket.on('join_tournament_room', async (data) => {
            const { tournament_id } = data;
            
            if (!currentUser) {
                return socket.emit('error', { error: 'Not authenticated' });
            }

            try {
                const tournament = await gameDb.getTournament(tournament_id);
                if (!tournament) {
                    return socket.emit('error', { error: 'Tournament not found' });
                }

                await socket.join(`tournament_${tournament_id}`);
                currentTournamentId = tournament_id;
                
                // Track tournament spectators
                if (!tournamentRooms.has(tournament_id)) {
                    tournamentRooms.set(tournament_id, new Set());
                }
                tournamentRooms.get(tournament_id).add(socket.id);
                
                const participants = await gameDb.getTournamentParticipants(tournament_id);
                const matches = await gameDb.getTournamentMatches(tournament_id);
                const announcements = await gameDb.getTournamentAnnouncements(tournament_id, currentUser.user_id);
                
                socket.emit('tournament_joined', {
                    tournament,
                    participants,
                    matches,
                    announcements,
                    spectator_count: tournamentRooms.get(tournament_id).size
                });

                socket.to(`tournament_${tournament_id}`).emit('tournament_spectator_joined', {
                    user: currentUser,
                    spectator_count: tournamentRooms.get(tournament_id).size
                });

            } catch (error) {
                console.error('Tournament join error:', error);
                socket.emit('error', { error: 'Failed to join tournament' });
            }
        });

        socket.on('leave_tournament_room', () => {
            if (currentTournamentId) {
                socket.leave(`tournament_${currentTournamentId}`);
                
                const spectators = tournamentRooms.get(currentTournamentId);
                if (spectators) {
                    spectators.delete(socket.id);
                    socket.to(`tournament_${currentTournamentId}`).emit('tournament_spectator_left', {
                        user: currentUser,
                        spectator_count: spectators.size
                    });
                }
                
                currentTournamentId = null;
            }
        });

        socket.on('tournament_match_request', async (data) => {
            const { tournament_id, opponent_id } = data;
            
            if (!currentUser) return;

            try {
                // Check if both players are participants
                const participant1 = await gameDb.getTournamentParticipant(tournament_id, currentUser.user_id);
                const participant2 = await gameDb.getTournamentParticipant(tournament_id, opponent_id);
                
                if (!participant1 || !participant2) {
                    return socket.emit('error', { error: 'Both players must be tournament participants' });
                }

                // Find their current match
                const matches = await gameDb.getTournamentMatches(tournament_id);
                const currentMatch = matches.find(m => 
                    (m.player1_id === currentUser.user_id && m.player2_id === opponent_id) ||
                    (m.player1_id === opponent_id && m.player2_id === currentUser.user_id)
                );

                if (!currentMatch || currentMatch.status !== 'ready') {
                    return socket.emit('error', { error: 'No available match between these players' });
                }

                // Create match ready announcement
                await gameDb.createMatchReadyAnnouncement(
                    tournament_id, 
                    currentMatch.id, 
                    [currentUser.user_id, opponent_id]
                );

                // Notify both players
                io.to(`user_${currentUser.user_id}`).emit('tournament_match_invitation', {
                    tournament_id,
                    match: currentMatch,
                    requested_by: currentUser
                });
                
                io.to(`user_${opponent_id}`).emit('tournament_match_invitation', {
                    tournament_id,
                    match: currentMatch,
                    requested_by: currentUser
                });

            } catch (error) {
                console.error('Tournament match request error:', error);
                socket.emit('error', { error: 'Failed to request tournament match' });
            }
        });

        socket.on('tournament_bracket_update_request', async (data) => {
            const { tournament_id } = data;
            
            if (!currentUser) return;

            try {
                const tournament = await gameDb.getTournament(tournament_id);
                const participants = await gameDb.getTournamentParticipants(tournament_id);
                const matches = await gameDb.getTournamentMatches(tournament_id);
                const announcements = await gameDb.getTournamentAnnouncements(tournament_id, currentUser.user_id);

                socket.emit('tournament_bracket_update', {
                    tournament,
                    participants,
                    matches,
                    announcements
                });

            } catch (error) {
                console.error('Tournament bracket update error:', error);
                socket.emit('error', { error: 'Failed to update tournament bracket' });
            }
        });

        // ========================================
        // CHAT & COMMUNICATION (enhanced)
        // ========================================

        socket.on('game_chat', (data) => {
            if (!currentRoom || !currentUser) return;

            const { message } = data;
            if (!message || message.trim().length === 0) return;

            const chatData = {
                user: currentUser,
                message: message.trim(),
                timestamp: Date.now(),
                room_type: currentTournamentId ? 'tournament_match' : 'casual_match'
            };

            io.to(currentRoom).emit('chat_message', chatData);

            // Also send to tournament room if applicable
            if (currentTournamentId) {
                socket.to(`tournament_${currentTournamentId}`).emit('tournament_match_chat', {
                    ...chatData,
                    game_session_id: currentGameSession?.id
                });
            }
        });

        socket.on('tournament_chat', (data) => {
            if (!currentTournamentId || !currentUser) return;

            const { message } = data;
            if (!message || message.trim().length === 0) return;

            const chatData = {
                user: currentUser,
                message: message.trim(),
                timestamp: Date.now(),
                chat_type: 'tournament_general'
            };

            io.to(`tournament_${currentTournamentId}`).emit('tournament_chat_message', chatData);
        });

        socket.on('game_emote', (data) => {
            if (!currentRoom || !currentUser) return;

            const { emote } = data;
            const allowedEmotes = ['👍', '👎', '😄', '😢', '🔥', '⚡', '🎉', '😎', '🏆', '🎯'];
            
            if (allowedEmotes.includes(emote)) {
                const emoteData = {
                    user: currentUser,
                    emote,
                    timestamp: Date.now()
                };

                socket.to(currentRoom).emit('player_emote', emoteData);

                // Send to tournament room if applicable
                if (currentTournamentId) {
                    socket.to(`tournament_${currentTournamentId}`).emit('tournament_match_emote', {
                        ...emoteData,
                        game_session_id: currentGameSession?.id
                    });
                }
            }
        });

        // ========================================
        // CONNECTION MANAGEMENT (enhanced)
        // ========================================

        socket.on('disconnect', () => {
            console.log(`🔌 Player disconnected: ${socket.id}`);
            
            if (currentRoom && currentUser) {
                handlePlayerLeave();
            }

            if (currentTournamentId) {
                const spectators = tournamentRooms.get(currentTournamentId);
                if (spectators) {
                    spectators.delete(socket.id);
                    socket.to(`tournament_${currentTournamentId}`).emit('tournament_spectator_left', {
                        user: currentUser,
                        spectator_count: spectators.size
                    });
                }
            }
        });

        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });

        // ========================================
        // HELPER FUNCTIONS (enhanced)
        // ========================================

        async function startGame(roomId) {
            const gameData = activeGames.get(roomId);
            if (!gameData) return;

            gameData.gameState.isRunning = true;
            gameData.gameState.isPaused = false;
            gameData.gameState.lastUpdate = Date.now();

            if (currentGameSession) {
                try {
                    await gameDb.updateGameSession(currentGameSession.id, {
                        status: 'active',
                        started_at: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('Error updating game session:', error);
                }
            }

            io.to(roomId).emit('game_started', {
                game_state: gameData.gameState,
                message: 'Game started! Good luck!'
            });

            // Notify tournament room if applicable
            if (currentTournamentId && currentGameSession) {
                io.to(`tournament_${currentTournamentId}`).emit('tournament_match_live', {
                    game_session_id: currentGameSession.id,
                    room_id: roomId,
                    players: Object.values(gameData.players)
                });
            }

            startGameLoop(roomId);
        }

        function startGameLoop(roomId) {
            const gameInterval = setInterval(async () => {
                const gameData = activeGames.get(roomId);
                if (!gameData || !gameData.gameState.isRunning) {
                    clearInterval(gameInterval);
                    return;
                }

                if (gameData.gameState.isPaused) return;

                await updateGamePhysics(gameData);
                
                io.to(roomId).emit('game_update', {
                    ball: gameData.gameState.ball,
                    paddle1: gameData.gameState.paddle1,
                    paddle2: gameData.gameState.paddle2,
                    timestamp: Date.now()
                });

                // Send live updates to tournament spectators
                if (currentTournamentId) {
                    socket.to(`tournament_${currentTournamentId}`).emit('tournament_match_update', {
                        game_session_id: currentGameSession?.id,
                        ball: gameData.gameState.ball,
                        paddle1: gameData.gameState.paddle1,
                        paddle2: gameData.gameState.paddle2
                    });
                }

                await checkScoring(roomId, gameData);

            }, 16); // ~60 FPS
        }

        async function updateGamePhysics(gameData) {
            const { ball, paddle1, paddle2 } = gameData.gameState;
            
            ball.x += ball.vx;
            ball.y += ball.vy;

            if (ball.y <= 0 || ball.y >= 600) {
                ball.vy = -ball.vy;
                if (currentGameSession) {
                    try {
                        await gameDb.recordGameEvent(currentGameSession.id, {
                            event_type: 'wall_bounce',
                            position_x: ball.x,
                            position_y: ball.y,
                            timestamp_ms: Date.now()
                        });
                    } catch (error) {
                        console.error('Error recording wall bounce:', error);
                    }
                }
            }

            const ballRadius = 10;
            const paddleWidth = 20;
            const paddleHeight = 100;

            // Left paddle collision
            if (ball.x - ballRadius <= paddleWidth && 
                ball.y >= paddle1.y && 
                ball.y <= paddle1.y + paddleHeight) {
                ball.vx = Math.abs(ball.vx);
                if (currentGameSession) {
                    try {
                        await gameDb.recordGameEvent(currentGameSession.id, {
                            event_type: 'paddle_hit',
                            player_id: currentGameSession.player1_id,
                            position_x: ball.x,
                            position_y: ball.y,
                            timestamp_ms: Date.now()
                        });
                    } catch (error) {
                        console.error('Error recording paddle hit:', error);
                    }
                }
            }

            // Right paddle collision
            if (ball.x + ballRadius >= 800 - paddleWidth && 
                ball.y >= paddle2.y && 
                ball.y <= paddle2.y + paddleHeight) {
                ball.vx = -Math.abs(ball.vx);
                if (currentGameSession) {
                    try {
                        await gameDb.recordGameEvent(currentGameSession.id, {
                            event_type: 'paddle_hit',
                            player_id: currentGameSession.player2_id,
                            position_x: ball.x,
                            position_y: ball.y,
                            timestamp_ms: Date.now()
                        });
                    } catch (error) {
                        console.error('Error recording paddle hit:', error);
                    }
                }
            }
        }

        async function checkScoring(roomId, gameData) {
            const { ball, paddle1, paddle2 } = gameData.gameState;

            let scored = false;
            let scorer = null;

            if (ball.x < 0) {
                paddle2.score++;
                scorer = 'player2';
                scored = true;
            } else if (ball.x > 800) {
                paddle1.score++;
                scorer = 'player1';
                scored = true;
            }

            if (scored) {
                ball.x = 400;
                ball.y = 300;
                ball.vx = (Math.random() > 0.5 ? 1 : -1) * 5;
                ball.vy = (Math.random() > 0.5 ? 1 : -1) * 3;

                const scorerUserId = scorer === 'player1' ? 
                    currentGameSession?.player1_id : currentGameSession?.player2_id;
                
                if (currentGameSession) {
                    try {
                        await gameDb.recordGameEvent(currentGameSession.id, {
                            event_type: 'goal',
                            player_id: scorerUserId,
                            position_x: ball.x,
                            position_y: ball.y,
                            data: { scorer, new_score: scorer === 'player1' ? paddle1.score : paddle2.score },
                            timestamp_ms: Date.now()
                        });
                    } catch (error) {
                        console.error('Error recording goal:', error);
                    }
                }

                const goalData = {
                    scorer,
                    player1_score: paddle1.score,
                    player2_score: paddle2.score,
                    ball_reset: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy }
                };

                io.to(roomId).emit('goal_scored', goalData);

                // Notify tournament spectators
                if (currentTournamentId) {
                    io.to(`tournament_${currentTournamentId}`).emit('tournament_match_goal', {
                        game_session_id: currentGameSession?.id,
                        ...goalData
                    });
                }

                if (paddle1.score >= 11 || paddle2.score >= 11) {
                    await endGame(roomId, gameData);
                }
            }
        }

        async function endGame(roomId, gameData) {
            const { paddle1, paddle2 } = gameData.gameState;
            gameData.gameState.isRunning = false;

            const winner = paddle1.score > paddle2.score ? 'player1' : 'player2';
            const winnerUserId = winner === 'player1' ? 
                currentGameSession?.player1_id : currentGameSession?.player2_id;
            const loserUserId = winner === 'player1' ? 
                currentGameSession?.player2_id : currentGameSession?.player1_id;

            if (currentGameSession) {
                try {
                    const gameDuration = currentGameSession.started_at ? 
                        Math.floor((Date.now() - new Date(currentGameSession.started_at).getTime()) / 1000) : 0;

                    await gameDb.updateGameSession(currentGameSession.id, {
                        player1_score: paddle1.score,
                        player2_score: paddle2.score,
                        winner_id: winnerUserId,
                        status: 'finished',
                        finished_at: new Date().toISOString(),
                        game_duration: gameDuration
                    });

                    // Update player statistics
                    await gameDb.updatePlayerStats(winnerUserId, { 
                        result: 'won', 
                        score: winner === 'player1' ? paddle1.score : paddle2.score,
                        duration: gameDuration
                    });
                    await gameDb.updatePlayerStats(loserUserId, { 
                        result: 'lost', 
                        score: winner === 'player1' ? paddle2.score : paddle1.score,
                        duration: gameDuration
                    });

                    // Handle tournament advancement if applicable
                    if (currentGameSession.tournament_id) {
                        try {
                            const matches = await gameDb.getTournamentMatches(currentGameSession.tournament_id);
                            const tournamentMatch = matches.find(m => m.game_session_id === currentGameSession.id);
                            
                            if (tournamentMatch) {
                                await gameDb.advanceWinnerToNextRound(tournamentMatch.id, winnerUserId);
                                
                                // Notify tournament room about the result
                                io.to(`tournament_${currentGameSession.tournament_id}`).emit('tournament_match_result', {
                                    tournament_id: currentGameSession.tournament_id,
                                    match_id: tournamentMatch.id,
                                    winner_id: winnerUserId,
                                    loser_id: loserUserId,
                                    final_score: {
                                        player1: paddle1.score,
                                        player2: paddle2.score
                                    },
                                    game_duration: gameDuration,
                                    result_type: 'completed'
                                });

                                // Check if tournament is complete or next round is ready
                                const updatedTournament = await gameDb.getTournament(currentGameSession.tournament_id);
                                const allMatches = await gameDb.getTournamentMatches(currentGameSession.tournament_id);
                                
                                io.to(`tournament_${currentGameSession.tournament_id}`).emit('tournament_bracket_update', {
                                    tournament: updatedTournament,
                                    matches: allMatches
                                });
                            }
                        } catch (error) {
                            console.error('Tournament advancement error:', error);
                        }
                    }
                } catch (error) {
                    console.error('Error updating game session:', error);
                }
            }

            const gameDuration = currentGameSession && currentGameSession.started_at ? 
                Math.floor((Date.now() - new Date(currentGameSession.started_at).getTime()) / 1000) : 0;

            const gameEndData = {
                winner,
                final_score: {
                    player1: paddle1.score,
                    player2: paddle2.score
                },
                winner_user_id: winnerUserId,
                game_duration: gameDuration
            };

            io.to(roomId).emit('game_ended', gameEndData);

            // Notify tournament spectators
            if (currentTournamentId && currentGameSession) {
                io.to(`tournament_${currentTournamentId}`).emit('tournament_match_ended', {
                    game_session_id: currentGameSession.id,
                    ...gameEndData
                });
            }

            // Clean up game after 10 seconds
            setTimeout(() => cleanupGame(roomId), 10000);
        }

        async function handlePlayerLeave() {
            if (currentRoom) {
                const gameData = activeGames.get(currentRoom);
                if (gameData && currentUser) {
                    delete gameData.players[currentUser.user_id];
                    
                    socket.to(currentRoom).emit('player_left', {
                        user: currentUser,
                        remaining_players: Object.keys(gameData.players).length
                    });

                    // If game was active, end it
                    if (gameData.gameState.isRunning) {
                        gameData.gameState.isRunning = false;
                        
                        const remainingPlayerIds = Object.keys(gameData.players);
                        if (remainingPlayerIds.length === 1) {
                            const winnerUserId = remainingPlayerIds[0];
                            
                            if (currentGameSession) {
                                try {
                                    await gameDb.updateGameSession(currentGameSession.id, {
                                        winner_id: winnerUserId,
                                        status: 'finished',
                                        finished_at: new Date().toISOString(),
                                        match_data: {
                                            ...currentGameSession.match_data,
                                            disconnect: true,
                                            disconnected_player: currentUser.user_id
                                        }
                                    });

                                    // Handle tournament advancement for disconnection
                                    if (currentGameSession.tournament_id) {
                                        try {
                                            const matches = await gameDb.getTournamentMatches(currentGameSession.tournament_id);
                                            const tournamentMatch = matches.find(m => m.game_session_id === currentGameSession.id);
                                            
                                            if (tournamentMatch) {
                                                await gameDb.advanceWinnerToNextRound(tournamentMatch.id, winnerUserId);
                                                
                                                io.to(`tournament_${currentGameSession.tournament_id}`).emit('tournament_match_result', {
                                                    tournament_id: currentGameSession.tournament_id,
                                                    match_id: tournamentMatch.id,
                                                    winner_id: winnerUserId,
                                                    loser_id: currentUser.user_id,
                                                    result_type: 'disconnect',
                                                    disconnected_player: currentUser.user_id
                                                });
                                            }
                                        } catch (error) {
                                            console.error('Tournament advancement error on disconnect:', error);
                                        }
                                    }
                                } catch (error) {
                                    console.error('Error updating disconnected game:', error);
                                }
                            }

                            socket.to(currentRoom).emit('game_ended', {
                                reason: 'disconnect',
                                disconnected_player: currentUser.username,
                                winner_user_id: winnerUserId
                            });
                        }
                    }

                    // Clean up if no players left
                    if (Object.keys(gameData.players).length === 0) {
                        await cleanupGame(currentRoom);
                    }
                }

                socket.leave(currentRoom);
                currentRoom = null;
            }

            if (currentUser) {
                socket.leave(`user_${currentUser.user_id}`);
                currentUser = null;
            }

            if (currentTournamentId) {
                socket.leave(`tournament_${currentTournamentId}`);
                currentTournamentId = null;
            }
        }

        async function cleanupGame(roomId) {
            activeGames.delete(roomId);
            try {
                await gameDb.removeActiveGameRoom(roomId);
                console.log(`🧹 Game room cleaned up: ${roomId}`);
            } catch (error) {
                console.error('Error cleaning up game room:', error);
            }
        }
    });

    // ========================================
    // PERIODIC CLEANUP TASKS (enhanced)
    // ========================================

    // Clean up expired invitations every 5 minutes
    setInterval(async () => {
        try {
            const cleaned = await gameDb.cleanupExpiredInvitations();
            if (cleaned > 0) {
                console.log(`🧹 Cleaned up ${cleaned} expired invitations`);
            }
        } catch (error) {
            console.error('Error cleaning up expired invitations:', error);
        }
    }, 5 * 60 * 1000);

    // Clean up expired announcements every 10 minutes
    setInterval(async () => {
        try {
            const cleaned = await gameDb.cleanupExpiredAnnouncements();
            if (cleaned > 0) {
                console.log(`🧹 Cleaned up ${cleaned} expired announcements`);
            }
        } catch (error) {
            console.error('Error cleaning up expired announcements:', error);
        }
    }, 10 * 60 * 1000);

    // Clean up old game rooms every hour
    setInterval(async () => {
        try {
            const cleaned = await gameDb.cleanupOldGameRooms(24);
            if (cleaned > 0) {
                console.log(`🧹 Cleaned up ${cleaned} old game rooms`);
            }
        } catch (error) {
            console.error('Error cleaning up old game rooms:', error);
        }
    }, 60 * 60 * 1000);

    // Tournament health check - advance matches with no-shows every 2 minutes
    setInterval(async () => {
        try {
            // Find matches that are past their deadline
            const expiredMatches = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT tm.*, t.auto_advance_timer
                    FROM tournament_matches tm
                    JOIN tournaments t ON tm.tournament_id = t.id
                    WHERE tm.status = 'ready' 
                    AND tm.deadline_at < CURRENT_TIMESTAMP
                    AND t.status = 'active'
                `, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
            });

            for (const match of expiredMatches) {
                try {
                    // Auto-advance or forfeit logic could go here
                    console.log(`⏰ Match ${match.id} in tournament ${match.tournament_id} has expired`);
                    
                    // For now, we'll just notify the tournament room
                    io.to(`tournament_${match.tournament_id}`).emit('tournament_match_expired', {
                        match_id: match.id,
                        tournament_id: match.tournament_id,
                        message: `Match between ${match.player1_username} and ${match.player2_username} has expired due to no-show`
                    });
                } catch (error) {
                    console.error(`Error handling expired match ${match.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in tournament health check:', error);
        }
    }, 2 * 60 * 1000);

    // Cleanup inactive tournament rooms every 30 minutes
    setInterval(() => {
        for (const [tournamentId, spectators] of tournamentRooms.entries()) {
            if (spectators.size === 0) {
                tournamentRooms.delete(tournamentId);
                console.log(`🧹 Cleaned up empty tournament room: ${tournamentId}`);
            }
        }
    }, 30 * 60 * 1000);

    console.log('🎮 Enhanced Pong Game Socket handlers with tournament support initialized');
}