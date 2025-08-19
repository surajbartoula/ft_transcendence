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
        const token = getStoredToken();
        if (!token || this.socket?.connected) return;

        this.socket = io('https://localhost:3004', {
            auth: { token },
            timeout: 10000,
            transports: ['websocket', 'polling'],
            forceNew: true
        });

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('Game socket connected');
            this.reconnectAttempts = 0;
            
            // Authenticate with game service
            if (this.currentUser) {
                this.socket?.emit('authenticate', {
                    user_id: this.currentUser.id,
                    username: this.currentUser.name
                });
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
            console.log('Game socket authenticated:', data);
        });

        this.socket.on('auth_error', (data) => {
            console.error('Game socket auth error:', data);
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
            window.dispatchEvent(new CustomEvent('gameState', { detail: data }));
        });

        this.socket.on('game_started', (data: any) => {
            window.dispatchEvent(new CustomEvent('gameStarted', { detail: data }));
        });

        this.socket.on('game_ended', (data: any) => {
            window.dispatchEvent(new CustomEvent('gameEnded', { detail: data }));
        });

        this.socket.on('player_joined', (data: any) => {
            window.dispatchEvent(new CustomEvent('playerJoined', { detail: data }));
        });

        this.socket.on('player_left', (data: any) => {
            window.dispatchEvent(new CustomEvent('playerLeft', { detail: data }));
        });

        this.socket.on('player_ready', (data: any) => {
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
            console.log('Game invitation received:', data);
            window.dispatchEvent(new CustomEvent('game_invitation', { detail: data }));
        });

        this.socket.on('game_invitation_response', (data: any) => {
            console.log('Game invitation response:', data);
            window.dispatchEvent(new CustomEvent('game_invitation_response', { detail: data }));
        });

        this.socket.on('game_ready', (data: any) => {
            console.log('Game ready:', data);
            window.dispatchEvent(new CustomEvent('game_ready', { detail: data }));
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
        if (this.socket && this.isConnected()) {
            this.socket.emit('join_game_room', {
                room_id: roomId,
                game_session_id: gameSessionId
            });
        }
    }

    leaveGameRoom(): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('leave_game_room');
        }
    }

    playerReady(): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('player_ready');
        }
    }

    movePaddle(direction: 'up' | 'down', y?: number): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('paddle_move', { direction, y });
        }
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