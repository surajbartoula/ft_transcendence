import { io, Socket } from 'socket.io-client';
import { getStoredToken, getStoredUser } from './auth';
import { showClickableNotification } from './ui';


class GameSocket {
    private socket: Socket | null = null;
    private currentUser: any = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;

    constructor() {
        this.currentUser = getStoredUser();
    }

    connect(): void {
        // Update current user data in case it changed since constructor
        this.currentUser = getStoredUser();
        
        const token = getStoredToken();
        // console.log('🔌 GameSocket: Attempting to connect...');
        // console.log('🔑 Token available:', !!token);
        // console.log('👤 Current user available:', !!this.currentUser);
        // console.log('🔌 Already connected:', this.socket?.connected);
        
        if (!token) {
            console.error('❌ GameSocket: No token available for connection');
            return;
        }
        
        if (this.socket?.connected) {
            console.log('✅ GameSocket: Already connected, skipping');
            return;
        }

        console.log('🌐 GameSocket: Creating socket connection to game service');
        this.socket = io('/', {
            path: '/game-socket/socket.io',
            auth: { token },
            timeout: 10000,
            transports: ['websocket', 'polling'],
            forceNew: true,
            withCredentials: true
        });
        
        console.log('🔌 GameSocket: Socket instance created, setting up event listeners...');
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ GameSocket: Connected successfully!');
            console.log('🔌 Socket ID:', this.socket?.id);
            this.reconnectAttempts = 0;
            
            // Authenticate with game service
            if (this.currentUser) {
                const authData = {
                    user_id: this.currentUser.id,
                    username: this.currentUser.name
                };
                // console.log('🔑 GameSocket: Sending authentication data:', authData);
                // console.log('🔑 User ID type:', typeof this.currentUser.id, 'Value:', this.currentUser.id);
                this.socket?.emit('authenticate', authData);
            } else {
                console.warn('⚠️ GameSocket: No current user data for authentication');
                console.warn('⚠️ Stored user data:', getStoredUser());
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Game socket disconnected:', reason);
            if (reason === 'io server disconnect') {
                // Server disconnected, try to reconnect
                this.handleReconnection();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Game socket connection error:', error);
            this.handleReconnection();
        });

        this.socket.on('authenticated', (data) => {
            console.log('✅ GameSocket: Authentication successful!', data);
        });

        this.socket.on('auth_error', (data) => {
            console.error('❌ GameSocket: Authentication failed!', data);
        });

        // Tournament event handlers
        this.socket.on('tournament_updated', (data: any) => {
            this.handleTournamentUpdate(data);
        });

        this.socket.on('tournament_started', (data: any) => {
            this.handleTournamentStarted(data);
        });

        this.socket.on('match_ready', (data: any) => {
            this.handleMatchReady(data);
        });

        this.socket.on('match_completed', (data: any) => {
            this.handleMatchCompleted(data);
        });

        this.socket.on('tournament_announcement', (data: any) => {
            this.handleTournamentAnnouncement(data);
        });

        // Game-specific events
        this.socket.on('game_state', (data: any) => {
            console.log('🎮 GameSocket: Game state update:', data);
            window.dispatchEvent(new CustomEvent('gameState', { detail: data }));
        });

        this.socket.on('game_started', (data: any) => {
            console.log('🚀 GameSocket: Game started!', data);
            window.dispatchEvent(new CustomEvent('gameStarted', { detail: data }));
        });

        this.socket.on('game_ended', (data: any) => {
            console.log('🏁 GameSocket: Game ended!', data);
            window.dispatchEvent(new CustomEvent('gameEnded', { detail: data }));
        });

        this.socket.on('player_joined', (data: any) => {
            console.log('👤 GameSocket: Player joined:', data);
            window.dispatchEvent(new CustomEvent('playerJoined', { detail: data }));
        });

        this.socket.on('player_left', (data: any) => {
            console.log('🚪 GameSocket: Player left:', data);
            window.dispatchEvent(new CustomEvent('playerLeft', { detail: data }));
        });

        this.socket.on('player_ready', (data: any) => {
            console.log('✅ GameSocket: Player ready:', data);
            window.dispatchEvent(new CustomEvent('playerReady', { detail: data }));
        });

        this.socket.on('game_update', (data: any) => {
            window.dispatchEvent(new CustomEvent('gameUpdate', { detail: data }));
        });

        this.socket.on('paddle_update', (data: any) => {
            window.dispatchEvent(new CustomEvent('paddleUpdate', { detail: data }));
        });

        this.socket.on('goal_scored', (data: any) => {
            window.dispatchEvent(new CustomEvent('goalScored', { detail: data }));
        });

        this.socket.on('game_paused', (data: any) => {
            window.dispatchEvent(new CustomEvent('gamePaused', { detail: data }));
        });

        this.socket.on('chat_message', (data: any) => {
            window.dispatchEvent(new CustomEvent('gameChatMessage', { detail: data }));
        });

        this.socket.on('player_emote', (data: any) => {
            window.dispatchEvent(new CustomEvent('playerEmote', { detail: data }));
        });

        // Tournament-specific socket events
        this.socket.on('tournament_joined', (data: any) => {
            window.dispatchEvent(new CustomEvent('tournamentJoined', { detail: data }));
        });

        this.socket.on('tournament_match_invitation', (data: any) => {
            window.dispatchEvent(new CustomEvent('tournamentMatchInvitation', { detail: data }));
        });

        this.socket.on('tournament_bracket_update', (data: any) => {
            window.dispatchEvent(new CustomEvent('tournamentBracketUpdate', { detail: data }));
        });

        this.socket.on('tournament_match_result', (data: any) => {
            window.dispatchEvent(new CustomEvent('tournamentMatchResult', { detail: data }));
        });

        this.socket.on('tournament_chat_message', (data: any) => {
            window.dispatchEvent(new CustomEvent('tournamentChatMessage', { detail: data }));
        });

        // Game invitation events
        this.socket.on('game_invitation', (data: any) => {
            console.log('📨 GameSocket: Game invitation received:', data);
            
            // Show global notification regardless of current page
            if (data.sender && data.sender.username) {
                console.log('📢 Showing global invitation notification');
                import('../utils/ui').then(({ showClickableNotification }) => {
                    showClickableNotification(
                        `${data.sender.username} challenged you to a match! Click to respond.`,
                        'info',
                        0, // Don't auto-dismiss
                        () => {
                            // Navigate to online lobby page
                            console.log('🎮 Navigating to online lobby to handle invitation');
                            const event = new CustomEvent('navigate', {
                                detail: { path: '/game/online' }
                            });
                            window.dispatchEvent(event);
                        }
                    );
                });
            }
            
            // Dispatch event for page-specific handlers
            window.dispatchEvent(new CustomEvent('game_invitation', { detail: data }));
        });

        this.socket.on('game_invitation_response', (data: any) => {
            console.log('📝 GameSocket: Game invitation response:', data);
            window.dispatchEvent(new CustomEvent('game_invitation_response', { detail: data }));
        });

        this.socket.on('game_ready', (data: any) => {
            console.log('🎮 GameSocket: Game ready!', data);
            window.dispatchEvent(new CustomEvent('game_ready', { detail: data }));
        });

        this.socket.on('user_room_rejoined', (data: any) => {
            console.log('✅ GameSocket: Successfully rejoined user room:', data);
        });

        this.socket.on('user_room_error', (data: any) => {
            console.error('❌ GameSocket: Failed to rejoin user room:', data);
        });

        this.socket.on('error', (data: any) => {
            console.error('Game socket error:', data);
        });
    }

    private handleReconnection(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect game socket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
                this.connect();
            }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
        } else {
            console.error('Max reconnection attempts reached for game socket');
        }
    }

    private handleTournamentUpdate(data: any): void {
        console.log('Tournament updated:', data);
        
        window.dispatchEvent(new CustomEvent('tournamentUpdate', { detail: data }));
        
        const isOnTournamentPage = window.location.pathname.includes('/tournament/') || 
                                  window.location.pathname.includes('/game/');
        if (!isOnTournamentPage && data.message) {
            showClickableNotification(data.message, 'info', 5000);
        }
    }
    
    private handleTournamentStarted(data: any): void {
        console.log('Tournament started:', data);
        
        window.dispatchEvent(new CustomEvent('tournamentStarted', { detail: data }));
        
        if (data.tournament_name) {
            showClickableNotification(
                `Tournament "${data.tournament_name}" has started!`, 
                'success', 
                8000,
                () => this.navigateToTournament(data.tournament_id, 'bracket')
            );
        }
    }
    
    private handleMatchReady(data: any): void {
        console.log('Match ready:', data);
        
        window.dispatchEvent(new CustomEvent('matchReady', { detail: data }));
        
        const currentUser = getStoredUser();
        if (currentUser && (data.player1_id === currentUser.id || data.player2_id === currentUser.id)) {
            showClickableNotification(
                `Your match is ready! Click to join.`, 
                'success', 
                0,
                () => this.navigateToMatch(data.match_id)
            );
        } else {
            showClickableNotification(`Match ready: ${data.player1_username} vs ${data.player2_username}`, 'info', 5000);
        }
    }
    
    private handleMatchCompleted(data: any): void {
        console.log('Match completed:', data);
        
        window.dispatchEvent(new CustomEvent('matchCompleted', { detail: data }));
        
        if (data.winner_username) {
            showClickableNotification(
                `${data.winner_username} wins! Final score: ${data.player1_score} - ${data.player2_score}`,
                'info',
                6000
            );
        }
    }
    
    private handleTournamentAnnouncement(data: any): void {
        console.log('Tournament announcement:', data);
        
        window.dispatchEvent(new CustomEvent('tournamentAnnouncement', { detail: data }));
        
        const notificationType = data.priority === 3 ? 'error' : data.priority === 2 ? 'warning' : 'info';
        const duration = data.priority === 3 ? 0 : data.priority === 2 ? 8000 : 5000;
        
        showClickableNotification(
            `📢 ${data.title}: ${data.message}`,
            notificationType,
            duration
        );
    }
    
    private navigateToTournament(tournamentId: number, section: 'lobby' | 'bracket' = 'bracket'): void {
        const path = `/game/tournament/remote/${section}/${tournamentId}`;
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
    }
    
    private navigateToMatch(matchId: number): void {
        const path = `/game/tournament/remote/match/${matchId}`;
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.reconnectAttempts = 0;
    }

    getSocket(): Socket | null {
        return this.socket;
    }

    isConnected(): boolean {
        return this.socket?.connected === true;
    }

    // Game room methods
    joinGameRoom(roomId: string, gameSessionId: number): void {
        console.log(`🏠 GameSocket: Attempting to join game room - Room: ${roomId}, Session: ${gameSessionId}`);
        
        if (!this.socket) {
            console.error('❌ GameSocket: No socket instance available');
            return;
        }
        
        if (!this.isConnected()) {
            console.error('❌ GameSocket: Socket not connected');
            return;
        }
        
        const joinData = {
            room_id: roomId,
            game_session_id: gameSessionId
        };
        
        console.log('📤 GameSocket: Sending join_game_room event with data:', joinData);
        this.socket.emit('join_game_room', joinData);
        
        // Add temporary listener for immediate feedback
        this.socket.once('game_state', (data) => {
            console.log('✅ GameSocket: Received game_state immediately after join:', data);
        });
        
        this.socket.once('error', (data) => {
            console.error('❌ GameSocket: Error after join_game_room:', data);
        });
    }

    leaveGameRoom(): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('leave_game_room');
        }
    }

    playerReady(): void {
        console.log('✅ GameSocket: Sending player ready signal');
        console.log('🔌 Socket connected:', this.isConnected());
        console.log('🔌 Socket ID:', this.socket?.id);
        
        if (!this.socket || !this.isConnected()) {
            console.error('❌ GameSocket: Cannot send ready - socket not connected');
            console.error('❌ Socket instance exists:', !!this.socket);
            console.error('❌ Socket connected:', this.socket?.connected);
            return;
        }
        
        console.log('📤 GameSocket: Emitting player_ready event...');
        this.socket.emit('player_ready');
        console.log('✅ GameSocket: Player ready signal sent successfully');
        
        // Add temporary listener to track response
        this.socket.once('player_ready', (data) => {
            console.log('🔄 GameSocket: Received player_ready response:', data);
        });
    }

    movePaddle(direction: 'up' | 'down', y?: number): void {
        if (!this.socket || !this.isConnected()) {
            console.warn('⚠️ GameSocket: Cannot move paddle - socket not connected');
            return;
        }
        
        const moveData = { direction, y };
        console.log('🏓 GameSocket: Sending paddle move:', moveData);
        this.socket.emit('paddle_move', moveData);
    }

    // Velocity-based paddle movement methods
    startMovingPaddle(direction: 'up' | 'down'): void {
        if (!this.socket || !this.isConnected()) {
            console.warn('⚠️ GameSocket: Cannot start moving paddle - socket not connected');
            return;
        }
        
        console.log(`🏓 PADDLE_DEBUG: Starting paddle movement - Direction: ${direction}`);
        this.socket.emit('paddle_move_start', { direction });
    }

    stopMovingPaddle(): void {
        if (!this.socket || !this.isConnected()) {
            console.warn('⚠️ GameSocket: Cannot stop moving paddle - socket not connected');
            return;
        }
        
        console.log('🏓 PADDLE_DEBUG: Stopping paddle movement');
        this.socket.emit('paddle_move_stop');
    }

    pauseGame(): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('game_pause');
        }
    }

    quitGame(): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('game_quit');
        }
    }

    rejoinUserRoom(): void {
        if (!this.socket || !this.isConnected()) {
            console.warn('⚠️ GameSocket: Cannot rejoin user room - socket not connected');
            return;
        }
        
        // Use current user data instead of parsing from localStorage again
        const userData = this.currentUser || getStoredUser();
        if (!userData || !userData.id) {
            console.warn('⚠️ GameSocket: Cannot rejoin user room - no user data');
            console.warn('⚠️ Current user data:', userData);
            return;
        }
        
        console.log('🔄 GameSocket: Requesting to rejoin user room...');
        const rejoinData = {
            user_id: userData.id,
            username: userData.name // Use 'name' field, not 'username'
        };
        console.log('📤 GameSocket: Rejoin data:', rejoinData);
        this.socket.emit('rejoin_user_room', rejoinData);
    }

    sendGameChat(message: string): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('game_chat', { message });
        }
    }

    sendGameEmote(emote: string): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('game_emote', { emote });
        }
    }

    // Tournament methods
    joinTournamentRoom(tournamentId: number): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('join_tournament_room', { tournament_id: tournamentId });
        }
    }

    leaveTournamentRoom(): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('leave_tournament_room');
        }
    }

    requestTournamentMatch(tournamentId: number, opponentId: string): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('tournament_match_request', {
                tournament_id: tournamentId,
                opponent_id: opponentId
            });
        }
    }

    requestTournamentBracketUpdate(tournamentId: number): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('tournament_bracket_update_request', {
                tournament_id: tournamentId
            });
        }
    }

    sendTournamentChat(message: string): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('tournament_chat', { message });
        }
    }

    ping(): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('ping');
        }
    }
}

// Creating singleton instance
const gameSocket = new GameSocket();

export default gameSocket;