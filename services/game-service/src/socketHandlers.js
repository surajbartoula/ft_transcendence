import { GameDatabaseService, db } from './database.js';

const gameDb = new GameDatabaseService();

// Game state management for active games
const activeGames = new Map();
const tournamentRooms = new Map(); // Track tournament spectators

export function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        
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
                    if (!user_id || !username) {
                        return socket.emit('user_room_error', { error: 'user_id and username required' });
                    }
                    currentUser = { user_id, username };
                }
                
                const userRoom = `user_${currentUser.user_id}`;
                await socket.join(userRoom);
                
                socket.emit('user_room_rejoined', { success: true });
            } catch (error) {
                socket.emit('user_room_error', { error: 'Failed to rejoin user room' });
            }
        });

        // ========================================
        // GAME ROOM MANAGEMENT
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

                const currentUserId = currentUser.user_id;
                const player1Id = gameSession.player1_id;
                const player2Id = gameSession.player2_id;
                
                
                const isPlayer = String(currentUserId) === String(player1Id) || 
                                String(currentUserId) === String(player2Id);
                
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

                const isPlayer1 = String(gameSession.player1_id) === String(currentUser.user_id);
                
                const updateData = {};
                updateData[isPlayer1 ? 'player1_socket_id' : 'player2_socket_id'] = socket.id;
                updateData.last_activity = new Date().toISOString();

                await gameDb.updateGameRoom(room_id, updateData);

                if (!activeGames.has(room_id)) {
                    activeGames.set(room_id, {
                        gameSession,
                        players: {},
                        gameState: {
                            ball: { x: 400, y: 300, vx: 5, vy: 1 },
                            paddle1: { y: 300, velocity: 0, isMoving: false, score: 0 },
                            paddle2: { y: 300, velocity: 0, isMoving: false, score: 0 },
                            isRunning: false,
                            isPaused: false,
                            lastUpdate: Date.now()
                        },
                        spectators: []
                    });
                } else {
                }

                const gameData = activeGames.get(room_id);
                gameData.players[currentUser.user_id] = {
                    socket_id: socket.id,
                    username: currentUser.username,
                    is_player1: isPlayer1,
                    ready: false
                };

                const currentPlayerCount = Object.keys(gameData.players).length;
                
                socket.to(room_id).emit('player_joined', {
                    user: currentUser,
                    players_count: currentPlayerCount
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

                const gameStateResponse = {
                    room_id,
                    game_session: gameSession,
                    game_state: gameData.gameState,
                    players: gameData.players,
                    your_role: isPlayer1 ? 'player1' : 'player2'
                };
                
                
                socket.emit('game_state', gameStateResponse);

            } catch (error) {
                socket.emit('error', { error: 'Failed to join game room' });
            }
        });

		socket.on('leave_game_room', () => {
			
			if (currentRoom && currentUser) {
				handlePlayerLeave();
			}
			
			// Ensure user is still in their user room for receiving invitations
			if (currentUser) {
				const userRoom = `user_${currentUser.user_id}`;
				/** Callback approach */
				socket.join(userRoom, (err) => {
					if (err) {
					} else {
					}
				});
			}
		});

        // ========================================
        // GAME CONTROL EVENTS
        // ========================================

        socket.on('player_ready', async () => {
            
            if (!currentRoom || !currentUser) {
                return;
            }

            const gameData = activeGames.get(currentRoom);
            if (!gameData) {
                return;
            }
            
            if (!gameData.players[currentUser.user_id]) {
                return;
            }

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
            } else {
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
            const maxPaddleY = 600 - 120; // GAME_HEIGHT - PADDLE_HEIGHT = 480
            
            
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
            
            const gameData = activeGames.get(roomId);
            if (!gameData) {
                return;
            }

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
                }
            } else {
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
            let updateCount = 0;
            
            // Fixed timestep accumulator variables
            const FIXED_TIMESTEP = 16.666667; // 60 FPS in milliseconds
            const MAX_FRAME_TIME = 250; // Prevent spiral of death (15 frames)
            let lastTime = Date.now();
            let accumulator = 0;
            
            const gameInterval = setInterval(async () => {
                const gameData = activeGames.get(roomId);
                if (!gameData || !gameData.gameState.isRunning) {
                    clearInterval(gameInterval);
                    return;
                }

                if (gameData.gameState.isPaused) {
                    lastTime = Date.now(); // Reset time to prevent large accumulator after unpause
                    return;
                }

                const currentTime = Date.now();
                let frameTime = currentTime - lastTime;
                lastTime = currentTime;
                
                // Prevent spiral of death
                frameTime = Math.min(frameTime, MAX_FRAME_TIME);
                accumulator += frameTime;
                
                // Fixed timestep physics updates
                while (accumulator >= FIXED_TIMESTEP) {
                    try {
                        await updateGamePhysics(gameData, roomId, currentGameSession, gameDb, io, FIXED_TIMESTEP);
                        accumulator -= FIXED_TIMESTEP;
                        updateCount++;
                        
                        // Check scoring after each physics step
                        await checkScoring(roomId, gameData);
                    } catch (error) {
                        // Continue the game loop even if physics update fails
                        accumulator -= FIXED_TIMESTEP; // Still consume the timestep to prevent loop lock
                    }
                }
                
                const updateData = {
                    ball: gameData.gameState.ball,
                    paddle1: gameData.gameState.paddle1,
                    paddle2: gameData.gameState.paddle2,
                    timestamp: currentTime
                };
                
                // Log every 300th update (once every 5 seconds at 60fps) to avoid spam
                
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

            }, 8); // Run at ~120 FPS to handle accumulator properly
        }

        // Line-Rectangle Continuous Collision Detection helper functions
        function lineIntersectRect(x1, y1, x2, y2, rx, ry, rw, rh) {
            // Check if line intersects with rectangle
            // Returns { hit: boolean, t: number, point: {x, y}, normal: {x, y} }
            let minT = Infinity;
            let hitPoint = null;
            let hitNormal = null;
            
            const dx = x2 - x1;
            const dy = y2 - y1;
            
            // Check intersection with each edge of the rectangle
            const edges = [
                // Left edge
                { x: rx, y: ry, x2: rx, y2: ry + rh, normal: { x: -1, y: 0 } },
                // Right edge  
                { x: rx + rw, y: ry, x2: rx + rw, y2: ry + rh, normal: { x: 1, y: 0 } },
                // Top edge
                { x: rx, y: ry, x2: rx + rw, y2: ry, normal: { x: 0, y: -1 } },
                // Bottom edge
                { x: rx, y: ry + rh, x2: rx + rw, y2: ry + rh, normal: { x: 0, y: 1 } }
            ];
            
            for (const edge of edges) {
                const t = lineIntersectLine(x1, y1, x2, y2, edge.x, edge.y, edge.x2, edge.y2);
                if (t !== null && t >= 0 && t <= 1 && t < minT) {
                    minT = t;
                    hitPoint = {
                        x: x1 + t * dx,
                        y: y1 + t * dy
                    };
                    hitNormal = edge.normal;
                }
            }
            
            return minT < Infinity ? { hit: true, t: minT, point: hitPoint, normal: hitNormal } : { hit: false };
        }
        
        function lineIntersectLine(x1, y1, x2, y2, x3, y3, x4, y4) {
            // Line 1: (x1,y1) to (x2,y2)
            // Line 2: (x3,y3) to (x4,y4)
            const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
            if (Math.abs(denom) < 1e-10) return null; // Lines are parallel
            
            const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
            const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
            
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                return t;
            }
            return null;
        }
        
        function ballPaddleCCD(ballPrevX, ballPrevY, ballX, ballY, ballRadius, paddleX, paddleY, paddleW, paddleH) {
            // Expand paddle by ball radius to treat ball as point
            const expandedPaddle = {
                x: paddleX - ballRadius,
                y: paddleY - ballRadius,
                w: paddleW + 2 * ballRadius,
                h: paddleH + 2 * ballRadius
            };
            
            // Check line intersection with expanded paddle
            const collision = lineIntersectRect(
                ballPrevX, ballPrevY, 
                ballX, ballY,
                expandedPaddle.x, expandedPaddle.y, 
                expandedPaddle.w, expandedPaddle.h
            );
            
            if (collision.hit) {
                // Calculate the actual collision point on the ball surface
                const ballCollisionX = ballPrevX + collision.t * (ballX - ballPrevX);
                const ballCollisionY = ballPrevY + collision.t * (ballY - ballPrevY);
                
                return {
                    hit: true,
                    t: collision.t,
                    ballX: ballCollisionX,
                    ballY: ballCollisionY,
                    normal: collision.normal
                };
            }
            
            return { hit: false };
        }

        async function updateGamePhysics(gameData, roomId, currentGameSession, gameDb, io, deltaTime = 16.666667) {
            const { ball, paddle1, paddle2 } = gameData.gameState;
            
            // Game constants (physics function scope)
            const BALL_RADIUS = 10;
            const PADDLE_WIDTH = 20;
            const PADDLE_HEIGHT = 120;
            const GAME_WIDTH = 800;
            const GAME_HEIGHT = 600;
            const MAX_PADDLE_Y = GAME_HEIGHT - PADDLE_HEIGHT; // 480
            
            // Update paddle positions based on velocity
            if (paddle1.isMoving && paddle1.velocity !== 0) {
                paddle1.y += paddle1.velocity;
                paddle1.y = Math.max(0, Math.min(MAX_PADDLE_Y, paddle1.y));
            }
            
            if (paddle2.isMoving && paddle2.velocity !== 0) {
                paddle2.y += paddle2.velocity;
                paddle2.y = Math.max(0, Math.min(MAX_PADDLE_Y, paddle2.y));
            }
            
            // Store previous ball position for continuous collision detection
            const prevBallX = ball.x;
            const prevBallY = ball.y;
            
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

            // Paddle collision detection using line-rectangle CCD
            
            // Left paddle collision (Player 1 - GREEN paddle)
            if (ball.vx < 0) { // Ball moving left
                const collision = ballPaddleCCD(
                    prevBallX, prevBallY, ball.x, ball.y,
                    BALL_RADIUS,
                    0, paddle1.y, PADDLE_WIDTH, PADDLE_HEIGHT
                );
                
                if (collision.hit) {
                    // Calculate hit position relative to paddle center for angle variation
                    const paddleCenter = paddle1.y + (PADDLE_HEIGHT / 2);
                    const hitOffset = Math.max(-1, Math.min(1, 
                        (collision.ballY - paddleCenter) / (PADDLE_HEIGHT / 2)
                    ));
                    
                    // Apply collision response
                    ball.vx = Math.abs(ball.vx); // Bounce right
                    ball.vy += hitOffset * 2.0; // Add angle variation
                    
                    // Clamp velocities to prevent extremely fast speeds
                    const maxSpeed = 12;
                    if (Math.abs(ball.vx) > maxSpeed) ball.vx = ball.vx > 0 ? maxSpeed : -maxSpeed;
                    if (Math.abs(ball.vy) > maxSpeed) ball.vy = ball.vy > 0 ? maxSpeed : -maxSpeed;
                    
                    // Position correction to prevent tunneling
                    ball.x = PADDLE_WIDTH + BALL_RADIUS + 1;
                    ball.y = Math.max(BALL_RADIUS, Math.min(GAME_HEIGHT - BALL_RADIUS, collision.ballY));
                    
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

            // Right paddle collision (Player 2 - RED paddle)
            if (ball.vx > 0) { // Ball moving right
                const paddleX = GAME_WIDTH - PADDLE_WIDTH;
                const collision = ballPaddleCCD(
                    prevBallX, prevBallY, ball.x, ball.y,
                    BALL_RADIUS,
                    paddleX, paddle2.y, PADDLE_WIDTH, PADDLE_HEIGHT
                );
                
                if (collision.hit) {
                    // Calculate hit position relative to paddle center for angle variation
                    const paddleCenter = paddle2.y + (PADDLE_HEIGHT / 2);
                    const hitOffset = Math.max(-1, Math.min(1, 
                        (collision.ballY - paddleCenter) / (PADDLE_HEIGHT / 2)
                    ));
                    
                    // Apply collision response
                    ball.vx = -Math.abs(ball.vx); // Bounce left
                    ball.vy += hitOffset * 2.0; // Add angle variation
                    
                    // Clamp velocities to prevent extremely fast speeds
                    const maxSpeed = 12;
                    if (Math.abs(ball.vx) > maxSpeed) ball.vx = ball.vx > 0 ? maxSpeed : -maxSpeed;
                    if (Math.abs(ball.vy) > maxSpeed) ball.vy = ball.vy > 0 ? maxSpeed : -maxSpeed;
                    
                    // Position correction to prevent tunneling
                    ball.x = paddleX - BALL_RADIUS - 1;
                    ball.y = Math.max(BALL_RADIUS, Math.min(GAME_HEIGHT - BALL_RADIUS, collision.ballY));
                    
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
                ball.vy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 1.5 + 0.5); // Random between 0.5 and 2

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
                    
                } catch (error) {
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
        } catch (error) {
            console.error('Error cleaning up expired invitations:', error);
        }
    }, 5 * 60 * 1000);

    // Clean up expired announcements every 10 minutes
    setInterval(async () => {
        try {
            const cleaned = await gameDb.cleanupExpiredAnnouncements();
        } catch (error) {
            console.error('Error cleaning up expired announcements:', error);
        }
    }, 10 * 60 * 1000);

    // Clean up old game rooms every hour
    setInterval(async () => {
        try {
            const cleaned = await gameDb.cleanupOldGameRooms(24);
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
            }
        }
    }, 30 * 60 * 1000);
}