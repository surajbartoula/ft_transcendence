import { GameDatabaseService } from './database.js';

const gameDb = new GameDatabaseService();

// Game state management for active games
const activeGames = new Map();

export function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Player connected: ${socket.id}`);
        
        let currentUser = null;
        let currentRoom = null;
        let currentGameSession = null;

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
        // GAME ROOM MANAGEMENT
        // ========================================

        socket.on('join_game_room', async (data) => {
            try {
                const { room_id, game_session_id } = data;
                
                if (!currentUser) {
                    return socket.emit('error', { error: 'Not authenticated' });
                }

                // Verify game session and user authorization
                const gameSession = await gameDb.getGameSession(game_session_id);
                if (!gameSession) {
                    return socket.emit('error', { error: 'Game session not found' });
                }

                const isPlayer = gameSession.player1_id === currentUser.user_id || 
                                gameSession.player2_id === currentUser.user_id;
                
                if (!isPlayer) {
                    return socket.emit('error', { error: 'Not authorized to join this game' });
                }

                // Join the game room
                await socket.join(room_id);
                currentRoom = room_id;
                currentGameSession = gameSession;

                // Update room with socket info
                const isPlayer1 = gameSession.player1_id === currentUser.user_id;
                const updateData = {};
                updateData[isPlayer1 ? 'player1_socket_id' : 'player2_socket_id'] = socket.id;
                updateData.last_activity = new Date().toISOString();

                await gameDb.updateGameRoom(room_id, updateData);

                // Initialize game state if not exists
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
                
                // Notify all players in the room
                socket.to(room_id).emit('player_joined', {
                    user: currentUser,
                    players_count: Object.keys(gameData.players).length
                });

                // Send current game state to the joining player
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
        // GAME CONTROL EVENTS
        // ========================================

        socket.on('player_ready', () => {
            if (!currentRoom || !currentUser) return;

            const gameData = activeGames.get(currentRoom);
            if (!gameData || !gameData.players[currentUser.user_id]) return;

            gameData.players[currentUser.user_id].ready = true;
            
            // Check if both players are ready
            const playerCount = Object.keys(gameData.players).length;
            const readyCount = Object.values(gameData.players).filter(p => p.ready).length;

            socket.to(currentRoom).emit('player_ready', {
                user: currentUser,
                ready_count: readyCount,
                total_players: playerCount
            });

            // Start game if both players are ready
            if (playerCount === 2 && readyCount === 2) {
                startGame(currentRoom);
            }
        });

        socket.on('paddle_move', (data) => {
            if (!currentRoom || !currentUser) return;

            const gameData = activeGames.get(currentRoom);
            if (!gameData || !gameData.gameState.isRunning) return;

            const player = gameData.players[currentUser.user_id];
            if (!player) return;

            const { direction, y } = data; // direction: 'up' | 'down' | 'stop', y: absolute position
            
            // Update paddle position
            if (player.is_player1) {
                gameData.gameState.paddle1.y = Math.max(0, Math.min(500, y || gameData.gameState.paddle1.y));
                if (direction === 'up') gameData.gameState.paddle1.y -= 10;
                if (direction === 'down') gameData.gameState.paddle1.y += 10;
            } else {
                gameData.gameState.paddle2.y = Math.max(0, Math.min(500, y || gameData.gameState.paddle2.y));
                if (direction === 'up') gameData.gameState.paddle2.y -= 10;
                if (direction === 'down') gameData.gameState.paddle2.y += 10;
            }

            // Broadcast paddle movement to other players
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

            // Record pause event
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
                // Determine winner (the other player)
                const otherPlayer = Object.values(gameData.players).find(p => p.socket_id !== socket.id);
                if (otherPlayer && currentGameSession) {
                    const winnerUserId = Object.keys(gameData.players).find(userId => 
                        gameData.players[userId].socket_id === otherPlayer.socket_id
                    );

                    // Update game session with forfeit
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

                    // Update player stats
                    await gameDb.updatePlayerStats(currentUser.user_id, { result: 'lost', score: 0 });
                    await gameDb.updatePlayerStats(winnerUserId, { result: 'won', score: 0 });
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

        socket.on('tournament_ready', (data) => {
            const { tournament_id, match_id } = data;
            
            if (!currentUser) return;

            // Mark player as ready for tournament match
            socket.to(`tournament_${tournament_id}`).emit('tournament_player_ready', {
                match_id,
                player: currentUser,
                ready: true
            });
        });

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
                
                const participants = await gameDb.getTournamentParticipants(tournament_id);
                
                socket.emit('tournament_joined', {
                    tournament,
                    participants
                });

                socket.to(`tournament_${tournament_id}`).emit('tournament_spectator_joined', {
                    user: currentUser
                });

            } catch (error) {
                console.error('Tournament join error:', error);
                socket.emit('error', { error: 'Failed to join tournament' });
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
                timestamp: Date.now()
            };

            io.to(currentRoom).emit('chat_message', chatData);
        });

        socket.on('game_emote', (data) => {
            if (!currentRoom || !currentUser) return;

            const { emote } = data;
            const allowedEmotes = ['👍', '👎', '😄', '😢', '🔥', '⚡', '🎉', '😎'];
            
            if (allowedEmotes.includes(emote)) {
                socket.to(currentRoom).emit('player_emote', {
                    user: currentUser,
                    emote,
                    timestamp: Date.now()
                });
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
        });

        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });

        // ========================================
        // HELPER FUNCTIONS
        // ========================================

        async function startGame(roomId) {
            const gameData = activeGames.get(roomId);
            if (!gameData) return;

            gameData.gameState.isRunning = true;
            gameData.gameState.isPaused = false;
            gameData.gameState.lastUpdate = Date.now();

            // Update database
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

            // Start game loop for this room
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
                
                // Broadcast game state to all players
                io.to(roomId).emit('game_update', {
                    ball: gameData.gameState.ball,
                    paddle1: gameData.gameState.paddle1,
                    paddle2: gameData.gameState.paddle2,
                    timestamp: Date.now()
                });

                // Check for scoring
                await checkScoring(roomId, gameData);

            }, 16); // ~60 FPS
        }

        async function updateGamePhysics(gameData) {
            const { ball, paddle1, paddle2 } = gameData.gameState;
            
            // Update ball position
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Ball collision with top/bottom walls
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

            // Ball collision with paddles
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

            // Player 2 scores (ball goes off left side)
            if (ball.x < 0) {
                paddle2.score++;
                scorer = 'player2';
                scored = true;
            }
            // Player 1 scores (ball goes off right side)
            else if (ball.x > 800) {
                paddle1.score++;
                scorer = 'player1';
                scored = true;
            }

            if (scored) {
                // Reset ball position
                ball.x = 400;
                ball.y = 300;
                ball.vx = (Math.random() > 0.5 ? 1 : -1) * 5;
                ball.vy = (Math.random() > 0.5 ? 1 : -1) * 3;

                // Record goal event
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

                io.to(roomId).emit('goal_scored', {
                    scorer,
                    player1_score: paddle1.score,
                    player2_score: paddle2.score,
                    ball_reset: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy }
                });

                // Check for game end (first to 11 points wins)
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

            // Update game session
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
                    console.error('Error updating game session:', error);
                }
            }

            const gameDuration = currentGameSession && currentGameSession.started_at ? 
                Math.floor((Date.now() - new Date(currentGameSession.started_at).getTime()) / 1000) : 0;

            io.to(roomId).emit('game_ended', {
                winner,
                final_score: {
                    player1: paddle1.score,
                    player2: paddle2.score
                },
                winner_user_id: winnerUserId,
                game_duration: gameDuration
            });

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
                        
                        // Determine winner (remaining player)
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

    console.log('🎮 Pong Game Socket handlers initialized');
}