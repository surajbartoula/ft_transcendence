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
                console.log(`🔔 DEBUG: User ${username} joined room user_${user_id}`);
                
                console.log(`✅ User authenticated: ${username} (${user_id})`);
                socket.emit('authenticated', { success: true, user: currentUser });
            } catch (error) {
                console.error('Authentication error:', error);
                socket.emit('auth_error', { error: 'Authentication failed' });
            }
        });

        // Force rejoin user room (for when users return to lobby after game)
        socket.on('rejoin_user_room', async (data) => {
            try {
                if (!currentUser) {
                    const { user_id, username } = data;
                    console.log(`🔍 DEBUG: rejoin_user_room data:`, data);
                    if (!user_id || !username) {
                        console.error('❌ DEBUG: Missing required data in rejoin_user_room:', { user_id, username });
                        return socket.emit('user_room_error', { error: 'user_id and username required' });
                    }
                    currentUser = { user_id, username };
                }
                
                const userRoom = `user_${currentUser.user_id}`;
                await socket.join(userRoom);
                console.log(`🔄 DEBUG: User ${currentUser.username} rejoined room ${userRoom}`);
                
                socket.emit('user_room_rejoined', { success: true });
            } catch (error) {
                console.error('❌ DEBUG: Failed to rejoin user room:', error);
                socket.emit('user_room_error', { error: 'Failed to rejoin user room' });
            }
        });

        // ========================================
        // GAME ROOM MANAGEMENT
        // ========================================

        socket.on('join_game_room', async (data) => {
            try {
                const { room_id, game_session_id } = data;
                console.log(`🏠 DEBUG: Join game room request - Room: ${room_id}, Session: ${game_session_id}, User: ${currentUser?.username || 'NOT_AUTH'}`);
                
                if (!currentUser) {
                    console.error('❌ DEBUG: User not authenticated for join_game_room');
                    return socket.emit('error', { error: 'Not authenticated' });
                }

                console.log(`🔍 DEBUG: Fetching game session ${game_session_id}...`);
                const gameSession = await gameDb.getGameSession(game_session_id);
                if (!gameSession) {
                    console.error(`❌ DEBUG: Game session ${game_session_id} not found`);
                    return socket.emit('error', { error: 'Game session not found' });
                }
                console.log(`✅ DEBUG: Game session found:`, { 
                    id: gameSession.id, 
                    player1_id: gameSession.player1_id, 
                    player2_id: gameSession.player2_id,
                    status: gameSession.status 
                });

                const currentUserId = currentUser.user_id;
                const player1Id = gameSession.player1_id;
                const player2Id = gameSession.player2_id;
                
                console.log(`🔍 DEBUG: Authorization check details:`);
                console.log(`  Current user ID: "${currentUserId}" (type: ${typeof currentUserId})`);
                console.log(`  Player 1 ID: "${player1Id}" (type: ${typeof player1Id})`);
                console.log(`  Player 2 ID: "${player2Id}" (type: ${typeof player2Id})`);
                console.log(`  Match P1: ${currentUserId === player1Id}`);
                console.log(`  Match P2: ${currentUserId === player2Id}`);
                console.log(`  String Match P1: ${String(currentUserId) === String(player1Id)}`);
                console.log(`  String Match P2: ${String(currentUserId) === String(player2Id)}`);
                
                const isPlayer = String(currentUserId) === String(player1Id) || 
                                String(currentUserId) === String(player2Id);
                
                if (!isPlayer) {
                    console.error(`❌ DEBUG: User ${currentUserId} not authorized for game (P1: ${player1Id}, P2: ${player2Id})`);
                    return socket.emit('error', { error: 'Not authorized to join this game' });
                }

                console.log(`🔌 DEBUG: Joining socket room ${room_id}...`);
                await socket.join(room_id);
                currentRoom = room_id;
                currentGameSession = gameSession;

                // If this is a tournament game, also join tournament room
                if (gameSession.tournament_id) {
                    currentTournamentId = gameSession.tournament_id;
                    await socket.join(`tournament_${gameSession.tournament_id}`);
                    console.log(`🏆 DEBUG: Also joined tournament room ${gameSession.tournament_id}`);
                }

                const isPlayer1 = String(gameSession.player1_id) === String(currentUser.user_id);
                console.log(`👤 DEBUG: Player role determination:`);
                console.log(`  - Current user ID: ${currentUser.user_id} (type: ${typeof currentUser.user_id})`);
                console.log(`  - Game session player1_id: ${gameSession.player1_id} (type: ${typeof gameSession.player1_id})`);
                console.log(`  - Game session player2_id: ${gameSession.player2_id} (type: ${typeof gameSession.player2_id})`);
                console.log(`  - Comparison result (isPlayer1): ${isPlayer1}`);
                
                const updateData = {};
                updateData[isPlayer1 ? 'player1_socket_id' : 'player2_socket_id'] = socket.id;
                updateData.last_activity = new Date().toISOString();

                await gameDb.updateGameRoom(room_id, updateData);
                console.log(`💾 DEBUG: Updated game room ${room_id} with socket ID ${socket.id}`);

                if (!activeGames.has(room_id)) {
                    console.log(`🆕 DEBUG: Creating new active game for room ${room_id}`);
                    activeGames.set(room_id, {
                        gameSession,
                        players: {},
                        gameState: {
                            ball: { x: 400, y: 300, vx: 5, vy: 3 },
                            paddle1: { y: 300, velocity: 0, isMoving: false, score: 0 },
                            paddle2: { y: 300, velocity: 0, isMoving: false, score: 0 },
                            isRunning: false,
                            isPaused: false,
                            lastUpdate: Date.now()
                        },
                        spectators: []
                    });
                } else {
                    console.log(`♻️ DEBUG: Using existing active game for room ${room_id}`);
                }

                const gameData = activeGames.get(room_id);
                gameData.players[currentUser.user_id] = {
                    socket_id: socket.id,
                    username: currentUser.username,
                    is_player1: isPlayer1,
                    ready: false
                };

                const currentPlayerCount = Object.keys(gameData.players).length;
                console.log(`👥 DEBUG: Player ${currentUser.username} joined game room: ${room_id} (${currentPlayerCount} players total)`);
                console.log(`👥 DEBUG: Current players:`, Object.values(gameData.players).map(p => ({ username: p.username, ready: p.ready, is_player1: p.is_player1 })));
                
                console.log(`📡 DEBUG: Emitting player_joined to other players in room ${room_id}`);
                socket.to(room_id).emit('player_joined', {
                    user: currentUser,
                    players_count: currentPlayerCount
                });

                // If tournament game, notify tournament room about active match
                if (gameSession.tournament_id) {
                    console.log(`🏆 DEBUG: Notifying tournament room about match start`);
                    socket.to(`tournament_${gameSession.tournament_id}`).emit('tournament_match_started', {
                        game_session_id: game_session_id,
                        room_id: room_id,
                        players: [
                            { id: gameSession.player1_id, is_ready: false },
                            { id: gameSession.player2_id, is_ready: false }
                        ]
                    });
                }

                const gameStateResponse = {
                    room_id,
                    game_session: gameSession,
                    game_state: gameData.gameState,
                    players: gameData.players,
                    your_role: isPlayer1 ? 'player1' : 'player2'
                };
                
                console.log(`📤 DEBUG: Emitting game_state to ${currentUser.username}:`, {
                    room_id,
                    your_role: gameStateResponse.your_role,
                    players_count: Object.keys(gameData.players).length,
                    game_running: gameData.gameState.isRunning,
                    game_paused: gameData.gameState.isPaused
                });
                
                socket.emit('game_state', gameStateResponse);
                console.log(`✅ DEBUG: Join game room complete for ${currentUser.username}`);

            } catch (error) {
                console.error('❌ DEBUG: Join room error:', error);
                console.error('❌ DEBUG: Error stack:', error.stack);
                socket.emit('error', { error: 'Failed to join game room' });
            }
        });

		socket.on('leave_game_room', () => {
			console.log(`🚪 DEBUG: Leave game room request from ${currentUser?.username || 'UNKNOWN'}`);
			console.log(`🚪 DEBUG: Current room: ${currentRoom}`);
			
			if (currentRoom && currentUser) {
				handlePlayerLeave();
			}
			
			// Ensure user is still in their user room for receiving invitations
			if (currentUser) {
				const userRoom = `user_${currentUser.user_id}`;
				/** Callback approach */
				socket.join(userRoom, (err) => {
					if (err) {
						console.error(`❌ DEBUG: Failed to rejoin user room ${userRoom}:`, err);
					} else {
						console.log(`🔔 DEBUG: Rejoined user room ${userRoom} for ${currentUser.username}`);
					}
				});
			}
		});

        // ========================================
        // GAME CONTROL EVENTS
        // ========================================

        socket.on('player_ready', async () => {
            console.log(`✅ DEBUG: Player ready signal received from ${currentUser?.username || 'UNKNOWN'}`);
            
            if (!currentRoom || !currentUser) {
                console.error(`❌ DEBUG: Missing currentRoom (${currentRoom}) or currentUser (${currentUser?.username || 'null'})`);
                return;
            }

            const gameData = activeGames.get(currentRoom);
            if (!gameData) {
                console.error(`❌ DEBUG: No game data found for room ${currentRoom}`);
                return;
            }
            
            if (!gameData.players[currentUser.user_id]) {
                console.error(`❌ DEBUG: Player ${currentUser.user_id} not found in game room ${currentRoom}`);
                console.error(`❌ DEBUG: Available players:`, Object.keys(gameData.players));
                return;
            }

            console.log(`🎯 DEBUG: Marking player ${currentUser.username} as ready in room ${currentRoom}`);
            gameData.players[currentUser.user_id].ready = true;
            
            const playerCount = Object.keys(gameData.players).length;
            const readyCount = Object.values(gameData.players).filter(p => p.ready).length;
            
            console.log(`📊 DEBUG: Ready status - ${readyCount}/${playerCount} players ready`);
            console.log(`📊 DEBUG: Player ready states:`, Object.values(gameData.players).map(p => ({ username: p.username, ready: p.ready })));

            console.log(`📡 DEBUG: Emitting player_ready to other players in room ${currentRoom}`);
            socket.to(currentRoom).emit('player_ready', {
                user: currentUser,
                ready_count: readyCount,
                total_players: playerCount
            });

            // Notify tournament room if applicable
            if (currentTournamentId) {
                console.log(`🏆 DEBUG: Notifying tournament room about player ready`);
                socket.to(`tournament_${currentTournamentId}`).emit('tournament_player_ready', {
                    user: currentUser,
                    game_session_id: currentGameSession?.id,
                    ready_count: readyCount,
                    total_players: playerCount
                });
            }

            // Start game if both players are ready
            if (playerCount === 2 && readyCount === 2) {
                console.log(`🚀 DEBUG: Both players ready! Starting game in room ${currentRoom}`);
                await startGame(currentRoom);
            } else {
                console.log(`⏳ DEBUG: Not ready to start - need 2 players (have ${playerCount}) and both ready (${readyCount} ready)`);
            }
        });

        // Velocity-based paddle movement handlers
        socket.on('paddle_move_start', (data) => {
            if (!currentRoom || !currentUser) return;
            
            const gameData = activeGames.get(currentRoom);
            if (!gameData || !gameData.gameState.isRunning) return;
            
            const player = gameData.players[currentUser.user_id];
            if (!player) return;
            
            const { direction } = data; // 'up' or 'down'
            const paddleVelocity = 8; // pixels per frame (at 60fps = 480 pixels/second)
            
            if (player.is_player1) {
                gameData.gameState.paddle1.velocity = direction === 'up' ? -paddleVelocity : paddleVelocity;
                gameData.gameState.paddle1.isMoving = true;
            } else {
                gameData.gameState.paddle2.velocity = direction === 'up' ? -paddleVelocity : paddleVelocity;
                gameData.gameState.paddle2.isMoving = true;
            }
        });

        socket.on('paddle_move_stop', () => {
            if (!currentRoom || !currentUser) return;
            
            const gameData = activeGames.get(currentRoom);
            if (!gameData || !gameData.gameState.isRunning) return;
            
            const player = gameData.players[currentUser.user_id];
            if (!player) return;
            
            if (player.is_player1) {
                gameData.gameState.paddle1.velocity = 0;
                gameData.gameState.paddle1.isMoving = false;
            } else {
                gameData.gameState.paddle2.velocity = 0;
                gameData.gameState.paddle2.isMoving = false;
            }
        });

        // Legacy paddle_move handler (for backward compatibility)
        socket.on('paddle_move', (data) => {
            if (!currentRoom || !currentUser) return;

            const gameData = activeGames.get(currentRoom);
            if (!gameData || !gameData.gameState.isRunning) return;

            const player = gameData.players[currentUser.user_id];
            if (!player) return;

            const { direction, y } = data;
            
            // Paddle dimensions for boundary checking  
            const maxPaddleY = 600 - 100; // GAME_HEIGHT - PADDLE_HEIGHT = 500
            
            
            if (player.is_player1) {
                let newY = gameData.gameState.paddle1.y;
                if (direction === 'up') newY -= 25;
                if (direction === 'down') newY += 25;
                if (y !== undefined) newY = y;
                
                // Constrain paddle within bounds (0 to 500)
                const constrainedY = Math.max(0, Math.min(maxPaddleY, newY));
                gameData.gameState.paddle1.y = constrainedY;
                
            } else {
                let newY = gameData.gameState.paddle2.y;
                if (direction === 'up') newY -= 25;
                if (direction === 'down') newY += 25;
                if (y !== undefined) newY = y;
                
                // Constrain paddle within bounds (0 to 500)
                const constrainedY = Math.max(0, Math.min(maxPaddleY, newY));
                gameData.gameState.paddle2.y = constrainedY;
                
            }

            // Notify other players of paddle update
            const updatedPlayer = player.is_player1 ? 'player1' : 'player2';
            const updatedY = player.is_player1 ? gameData.gameState.paddle1.y : gameData.gameState.paddle2.y;

            socket.to(currentRoom).emit('paddle_update', {
                player: updatedPlayer,
                y: updatedY
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
        // TOURNAMENT EVENTS
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
                    (String(m.player1_id) === String(currentUser.user_id) && String(m.player2_id) === String(opponent_id)) ||
                    (String(m.player1_id) === String(opponent_id) && String(m.player2_id) === String(currentUser.user_id))
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
        // CHAT & COMMUNICATION
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
        // CONNECTION MANAGEMENT
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
        // HELPER FUNCTIONS
        // ========================================

        async function startGame(roomId) {
            console.log(`🚀 DEBUG: Starting game in room ${roomId}`);
            
            const gameData = activeGames.get(roomId);
            if (!gameData) {
                console.error(`❌ DEBUG: No game data found for room ${roomId} in startGame`);
                return;
            }

            console.log(`🎮 DEBUG: Setting game state to running for room ${roomId}`);
            gameData.gameState.isRunning = true;
            gameData.gameState.isPaused = false;
            gameData.gameState.lastUpdate = Date.now();

            if (currentGameSession) {
                try {
                    console.log(`💾 DEBUG: Updating game session ${currentGameSession.id} to active status`);
                    await gameDb.updateGameSession(currentGameSession.id, {
                        status: 'active',
                        started_at: new Date().toISOString()
                    });
                    console.log(`✅ DEBUG: Game session updated successfully`);
                } catch (error) {
                    console.error('❌ DEBUG: Error updating game session:', error);
                }
            } else {
                console.warn(`⚠️ DEBUG: No currentGameSession to update`);
            }

            console.log(`📡 DEBUG: Emitting game_started to all players in room ${roomId}`);
            io.to(roomId).emit('game_started', {
                game_state: gameData.gameState,
                message: 'Game started! Good luck!'
            });

            // Notify tournament room if applicable
            if (currentTournamentId && currentGameSession) {
                console.log(`🏆 DEBUG: Notifying tournament room ${currentTournamentId} about live match`);
                io.to(`tournament_${currentTournamentId}`).emit('tournament_match_live', {
                    game_session_id: currentGameSession.id,
                    room_id: roomId,
                    players: Object.values(gameData.players)
                });
            }

            console.log(`🔄 DEBUG: Starting game loop for room ${roomId}`);
            startGameLoop(roomId);
            console.log(`✅ DEBUG: Game start sequence complete for room ${roomId}`);
        }

        function startGameLoop(roomId) {
            console.log(`🔄 DEBUG: Game loop started for room ${roomId}`);
            let updateCount = 0;
            
            const gameInterval = setInterval(async () => {
                const gameData = activeGames.get(roomId);
                if (!gameData || !gameData.gameState.isRunning) {
                    console.log(`🔴 DEBUG: Game loop stopping for room ${roomId} - Data exists: ${!!gameData}, Running: ${gameData?.gameState?.isRunning}`);
                    clearInterval(gameInterval);
                    return;
                }

                if (gameData.gameState.isPaused) {
                    console.log(`⏸️ DEBUG: Game paused, skipping update for room ${roomId}`);
                    return;
                }

                try {
                    await updateGamePhysics(gameData, roomId, currentGameSession, gameDb, io);
                } catch (error) {
                    console.error(`❌ DEBUG: Error in updateGamePhysics for room ${roomId}:`, error);
                    // Continue the game loop even if physics update fails
                }
                updateCount++;
                
                const updateData = {
                    ball: gameData.gameState.ball,
                    paddle1: gameData.gameState.paddle1,
                    paddle2: gameData.gameState.paddle2,
                    timestamp: Date.now()
                };
                
                // Log every 300th update (once every 5 seconds at 60fps) to avoid spam
                if (updateCount % 300 === 1) {
                    console.log(`🎮 Game update #${updateCount} for room ${roomId} - Players: ${Object.keys(gameData.players).length}`);
                }
                
                io.to(roomId).emit('game_update', updateData);

                // Send live updates to tournament spectators
                if (currentTournamentId) {
                    socket.to(`tournament_${currentTournamentId}`).emit('tournament_match_update', {
                        game_session_id: currentGameSession?.id,
                        ball: gameData.gameState.ball,
                        paddle1: gameData.gameState.paddle1,
                        paddle2: gameData.gameState.paddle2
                    });
                }

                try {
                    await checkScoring(roomId, gameData);
                } catch (error) {
                    console.error(`❌ DEBUG: Error in checkScoring for room ${roomId}:`, error);
                    // Continue the game loop even if scoring check fails
                }

            }, 16); // ~60 FPS
        }

        async function updateGamePhysics(gameData, roomId, currentGameSession, gameDb, io) {
            const { ball, paddle1, paddle2 } = gameData.gameState;
            
            // Game constants (physics function scope)
            const BALL_RADIUS = 10;
            const PADDLE_WIDTH = 20;
            const PADDLE_HEIGHT = 100;
            const GAME_WIDTH = 800;
            const GAME_HEIGHT = 600;
            const MAX_PADDLE_Y = GAME_HEIGHT - PADDLE_HEIGHT; // 500
            
            // Update paddle positions based on velocity
            if (paddle1.isMoving && paddle1.velocity !== 0) {
                paddle1.y += paddle1.velocity;
                paddle1.y = Math.max(0, Math.min(MAX_PADDLE_Y, paddle1.y));
            }
            
            if (paddle2.isMoving && paddle2.velocity !== 0) {
                paddle2.y += paddle2.velocity;
                paddle2.y = Math.max(0, Math.min(MAX_PADDLE_Y, paddle2.y));
            }
            
            // Update ball position
            ball.x += ball.vx;
            ball.y += ball.vy;

            
            // Wall collision (top and bottom) with improved boundary checking
            if (ball.y - BALL_RADIUS <= 0) {
                ball.vy = Math.abs(ball.vy); // Ensure ball bounces down
                ball.y = BALL_RADIUS; // Correct position to stay inside bounds
                
                // Emit wall bounce sound event to clients
                io.to(roomId).emit('audio_event', { type: 'wall_bounce' });
                
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
            } else if (ball.y + BALL_RADIUS >= GAME_HEIGHT) {
                ball.vy = -Math.abs(ball.vy); // Ensure ball bounces up  
                ball.y = GAME_HEIGHT - BALL_RADIUS; // Correct position to stay inside bounds
                
                // Emit wall bounce sound event to clients
                io.to(roomId).emit('audio_event', { type: 'wall_bounce' });
                
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

            // Store previous ball position for continuous collision detection
            const prevBallX = ball.x - ball.vx;
            const prevBallY = ball.y - ball.vy;

            // Left paddle collision (Player 1 - GREEN paddle)
            if (ball.vx < 0) { // Ball moving left
                const paddleRight = PADDLE_WIDTH;
                const paddleTop = paddle1.y;
                const paddleBottom = paddle1.y + PADDLE_HEIGHT;
                
                //Collision detection - check both continuous movement and current overlap
                const ballWasRightOfPaddle = prevBallX - BALL_RADIUS > paddleRight;
                const ballIsAtOrInPaddle = ball.x - BALL_RADIUS <= paddleRight;
                const ballCurrentlyOverlapsPaddle = ball.x - BALL_RADIUS <= paddleRight && ball.x + BALL_RADIUS >= 0;
                
                // Additional edge case: check if ball is already overlapping from previous frame
                const ballWasOverlapping = prevBallX - BALL_RADIUS <= paddleRight && prevBallX + BALL_RADIUS >= 0;
                
                if ((ballWasRightOfPaddle && ballIsAtOrInPaddle) || (ballCurrentlyOverlapsPaddle && !ballWasOverlapping)) {
                    // Calculate intersection point on paddle face
                    const intersectX = paddleRight + BALL_RADIUS;
                    const timeToIntersection = Math.abs(ball.vx) > 0 ? (prevBallX - intersectX) / Math.abs(ball.vx) : 0;
                    const intersectY = prevBallY + (ball.vy * timeToIntersection);
                    
                    // Tolerance for edge detection
                    const tolerance = BALL_RADIUS * 0.8; // Increased tolerance for better edge hits
                    const minY = paddleTop - tolerance;
                    const maxY = paddleBottom + tolerance;
                    
                    // Check if intersection or current ball position is within paddle bounds
                    const ballCenterY = ball.y;
                    const intersectionInBounds = intersectY >= minY && intersectY <= maxY;
                    const currentPositionInBounds = ballCenterY >= minY && ballCenterY <= maxY;
                    
                    if (intersectionInBounds || currentPositionInBounds) {
                        // Use the more accurate Y position for collision
                        const collisionY = intersectionInBounds ? intersectY : ballCenterY;
                        
                        // Angle calculation with better edge handling
                        const paddleCenter = paddleTop + (PADDLE_HEIGHT / 2);
                        const hitOffset = Math.max(-1, Math.min(1, (collisionY - paddleCenter) / (PADDLE_HEIGHT / 2))); // Clamp to -1 to 1
                        
                        ball.vx = Math.abs(ball.vx); // Bounce right
                        ball.vy += hitOffset * 2.0; // Increased angle influence for better gameplay
                        
                        // Clamp velocities to prevent extremely fast speeds
                        const maxSpeed = 12;
                        if (Math.abs(ball.vx) > maxSpeed) ball.vx = ball.vx > 0 ? maxSpeed : -maxSpeed;
                        if (Math.abs(ball.vy) > maxSpeed) ball.vy = ball.vy > 0 ? maxSpeed : -maxSpeed;
                        
                        // Correct ball position to prevent sticking and ensure proper separation
                        ball.x = Math.max(intersectX, paddleRight + BALL_RADIUS + 1); // Add 1px buffer
                        ball.y = Math.max(BALL_RADIUS, Math.min(GAME_HEIGHT - BALL_RADIUS, collisionY));
                        
                        // Emit paddle hit sound event to clients
                        io.to(roomId).emit('audio_event', { type: 'paddle_hit' });
                        
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
                }
            }

            // Right paddle collision (Player 2 - RED paddle)
            if (ball.vx > 0) { // Ball moving right
                const paddleLeft = GAME_WIDTH - PADDLE_WIDTH;
                const paddleTop = paddle2.y;
                const paddleBottom = paddle2.y + PADDLE_HEIGHT;
                
                // Check both continuous movement and current overlap
                const ballWasLeftOfPaddle = prevBallX + BALL_RADIUS < paddleLeft;
                const ballIsAtOrInPaddle = ball.x + BALL_RADIUS >= paddleLeft;
                const ballCurrentlyOverlapsPaddle = ball.x + BALL_RADIUS >= paddleLeft && ball.x - BALL_RADIUS <= GAME_WIDTH;
                
                // Check if ball is already overlapping from previous frame
                const ballWasOverlapping = prevBallX + BALL_RADIUS >= paddleLeft && prevBallX - BALL_RADIUS <= GAME_WIDTH;
                
                if ((ballWasLeftOfPaddle && ballIsAtOrInPaddle) || (ballCurrentlyOverlapsPaddle && !ballWasOverlapping)) {
                    // Calculate intersection point on paddle face
                    const intersectX = paddleLeft - BALL_RADIUS;
                    const timeToIntersection = Math.abs(ball.vx) > 0 ? (intersectX - prevBallX) / Math.abs(ball.vx) : 0;
                    const intersectY = prevBallY + (ball.vy * timeToIntersection);
                    
                    // larger tolerance for better edge catching
                    const tolerance = BALL_RADIUS * 0.8; // Increased tolerance for better edge hits
                    const minY = paddleTop - tolerance;
                    const maxY = paddleBottom + tolerance;
                    
                    // Check if intersection or current ball position is within paddle bounds
                    const ballCenterY = ball.y;
                    const intersectionInBounds = intersectY >= minY && intersectY <= maxY;
                    const currentPositionInBounds = ballCenterY >= minY && ballCenterY <= maxY;
                    
                    if (intersectionInBounds || currentPositionInBounds) {
                        // Use the more accurate Y position for collision
                        const collisionY = intersectionInBounds ? intersectY : ballCenterY;
                        
                        // Angle calculation with better edge handling
                        const paddleCenter = paddleTop + (PADDLE_HEIGHT / 2);
                        const hitOffset = Math.max(-1, Math.min(1, (collisionY - paddleCenter) / (PADDLE_HEIGHT / 2))); // Clamp to -1 to 1
                        
                        ball.vx = -Math.abs(ball.vx); // Bounce left
                        ball.vy += hitOffset * 2.0; // Increased angle influence for better gameplay
                        
                        // Clamp velocities to prevent extremely fast speeds
                        const maxSpeed = 12;
                        if (Math.abs(ball.vx) > maxSpeed) ball.vx = ball.vx > 0 ? maxSpeed : -maxSpeed;
                        if (Math.abs(ball.vy) > maxSpeed) ball.vy = ball.vy > 0 ? maxSpeed : -maxSpeed;
                        
                        // Correct ball position to prevent sticking and ensure proper separation
                        ball.x = Math.min(intersectX, paddleLeft - BALL_RADIUS - 1); // Add 1px buffer
                        ball.y = Math.max(BALL_RADIUS, Math.min(GAME_HEIGHT - BALL_RADIUS, collisionY));
                        
                        // Emit paddle hit sound event to clients
                        io.to(roomId).emit('audio_event', { type: 'paddle_hit' });
                        
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

                if (paddle1.score >= 7 || paddle2.score >= 7) {
                    try {
                        await endGame(roomId, gameData);
                    } catch (error) {
                        console.error(`❌ DEBUG: Error ending game for room ${roomId}:`, error);
                        // Force game to end even if database operations fail
                        gameData.gameState.isRunning = false;
                        io.to(roomId).emit('game_ended', {
                            winner: paddle1.score > paddle2.score ? 'player1' : 'player2',
                            final_score: { player1: paddle1.score, player2: paddle2.score },
                            reason: 'error_fallback'
                        });
                    }
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
                    console.log(`🏁 DEBUG: Ending game - Session: ${currentGameSession.id}, Winner: ${winner}`);
                    
                    const gameDuration = currentGameSession.started_at ? 
                        Math.floor((Date.now() - new Date(currentGameSession.started_at).getTime()) / 1000) : 0;

                    console.log(`💾 DEBUG: Updating game session in database...`);
                    await gameDb.updateGameSession(currentGameSession.id, {
                        player1_score: paddle1.score,
                        player2_score: paddle2.score,
                        winner_id: winnerUserId,
                        status: 'finished',
                        finished_at: new Date().toISOString(),
                        game_duration: gameDuration
                    });

                    console.log(`📊 DEBUG: Updating player statistics...`);
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
                    
                    console.log(`✅ DEBUG: Game session and stats updated successfully`);
                } catch (error) {
                    console.error(`❌ DEBUG: Database error during game end:`, error);
                    // Don't throw - continue with emitting game_ended event
                }

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
                    // Store user data before any potential modifications
                    const disconnectingUser = {
                        user_id: currentUser.user_id,
                        username: currentUser.username || 'Unknown Player'
                    };
                    
                    delete gameData.players[disconnectingUser.user_id];
                    
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
                                            disconnected_player: disconnectingUser.user_id
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
                                                    loser_id: disconnectingUser.user_id,
                                                    result_type: 'disconnect',
                                                    disconnected_player: disconnectingUser.user_id
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
                                disconnected_player: disconnectingUser.username,
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
    // PERIODIC CLEANUP TASKS
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
}