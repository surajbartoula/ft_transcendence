// Remote Tournament API Service - Direct connection to game-service
import { showError, showNotification } from '../utils/ui';

const GAME_SERVICE_URL = 'https://localhost:3004';

export interface Tournament {
    id: number;
    name: string;
    description: string;
    creator_id: string;
    max_players: number;
    current_players: number;
    status: 'registration' | 'active' | 'finished' | 'cancelled';
    tournament_type: 'single_elimination' | 'double_elimination' | 'round_robin';
    seeding_method: 'random' | 'ranking' | 'manual';
    auto_advance_timer: number;
    created_at: string;
    started_at?: string;
    finished_at?: string;
    winner_id?: string;
    current_round: number;
    total_rounds: number;
    settings: any;
    participants?: TournamentParticipant[];
    matches?: TournamentMatch[];
    announcements?: TournamentAnnouncement[];
}

export interface TournamentParticipant {
    id: number;
    tournament_id: number;
    user_id: string;
    username: string;
    seed_number?: number;
    ranking_points: number;
    joined_at: string;
    eliminated_at?: string;
    final_position?: number;
    status: 'active' | 'eliminated' | 'winner';
}

export interface TournamentMatch {
    id: number;
    tournament_id: number;
    round_number: number;
    match_number: number;
    bracket_position: string;
    player1_id?: string;
    player2_id?: string;
    player1_seed?: number;
    player2_seed?: number;
    player1_username?: string;
    player2_username?: string;
    winner_id?: string;
    winner_username?: string;
    game_session_id?: number;
    status: 'pending' | 'ready' | 'active' | 'finished' | 'walkover';
    scheduled_at?: string;
    deadline_at?: string;
}

export interface TournamentAnnouncement {
    id: number;
    tournament_id: number;
    announcement_type: 'general' | 'match_ready' | 'match_result' | 'round_complete' | 'player_advance' | 'elimination' | 'tournament_start' | 'tournament_end';
    title: string;
    message: string;
    target_users?: string[];
    match_id?: number;
    priority: 1 | 2 | 3;
    created_at: string;
    expires_at: string;
    is_read_by: string[];
    created_by?: string;
}

export interface GameSession {
    id: number;
    player1_id: string;
    player2_id: string;
    player1_score: number;
    player2_score: number;
    winner_id?: string;
    game_mode: 'local' | 'remote' | 'ai' | 'tournament';
    game_duration?: number;
    created_at: string;
    started_at?: string;
    finished_at?: string;
    status: 'waiting' | 'active' | 'paused' | 'finished' | 'cancelled';
    tournament_id?: number;
    match_data: any;
    room_id?: string;
}

export interface GameInvitation {
    id: number;
    sender_id: string;
    receiver_id: string;
    game_mode: 'remote' | 'tournament';
    tournament_id?: number;
    message: string;
    status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
    created_at: string;
    expires_at: string;
    responded_at?: string;
    sender_username?: string;
    receiver_username?: string;
}

class RemoteTournamentService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = GAME_SERVICE_URL;
    }

    private getAuthHeaders(): Record<string, string> {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return data.success ? data : data;
    }

    // ================================
    // TOURNAMENT MANAGEMENT
    // ================================

    async createTournament(tournamentData: {
        name: string;
        description?: string;
        max_players?: number;
        tournament_type?: string;
        seeding_method?: string;
        auto_advance_timer?: number;
    }): Promise<Tournament> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/tournament`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(tournamentData)
            });
            
            const result = await this.handleResponse<{ tournament: Tournament }>(response);
            return result.tournament;
        } catch (error) {
            console.error('Failed to create tournament:', error);
            showError(`Failed to create tournament: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async getTournament(tournamentId: number): Promise<Tournament> {
        console.log(`🌐 RemoteTournamentService: Getting tournament ${tournamentId}`);
        console.log(`   Called from:`, new Error().stack?.split('\n')[2]?.trim());
        
        try {
            const response = await fetch(`${this.baseUrl}/api/game/tournament/${tournamentId}`, {
                headers: this.getAuthHeaders()
            });
            
            const result = await this.handleResponse<{ tournament: Tournament }>(response);
            return result.tournament;
        } catch (error) {
            console.error(`❌ Failed to get tournament ${tournamentId}:`, error);
            throw error;
        }
    }

    async joinTournament(tournamentId: number): Promise<{ tournament: Tournament; participants: TournamentParticipant[] }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/tournament/${tournamentId}/join`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({})
            });
            
            const result = await this.handleResponse<{ tournament: Tournament; participants: TournamentParticipant[] }>(response);
            showNotification('Successfully joined tournament!', 'success');
            return result;
        } catch (error) {
            console.error('Failed to join tournament:', error);
            
            // Handle specific error cases
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (errorMessage.includes('UNIQUE constraint failed') || errorMessage.includes('already participant')) {
                showError('You are already registered for this tournament');
            } else if (errorMessage.includes('tournament is full')) {
                showError('Tournament is full - no more spots available');
            } else if (errorMessage.includes('tournament has started') || errorMessage.includes('registration closed')) {
                showError('Tournament registration is closed');
            } else {
                showError(`Failed to join tournament: ${errorMessage}`);
            }
            throw error;
        }
    }

    async startTournament(tournamentId: number): Promise<{ tournament: Tournament; matches: TournamentMatch[]; announcements: TournamentAnnouncement[] }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/tournament/${tournamentId}/start`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            
            const result = await this.handleResponse<{ tournament: Tournament; matches: TournamentMatch[]; announcements: TournamentAnnouncement[] }>(response);
            showNotification('Tournament started!', 'success');
            return result;
        } catch (error) {
            console.error('Failed to start tournament:', error);
            showError(`Failed to start tournament: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async getTournaments(status: string = 'registration', limit: number = 20, offset: number = 0): Promise<Tournament[]> {
        try {
            const params = new URLSearchParams({
                status,
                limit: limit.toString(),
                offset: offset.toString()
            });

            const response = await fetch(`${this.baseUrl}/api/game/tournaments?${params}`, {
                headers: this.getAuthHeaders()
            });
            
            const result = await this.handleResponse<{ tournaments: Tournament[] }>(response);
            return result.tournaments;
        } catch (error) {
            console.error('Failed to get tournaments:', error);
            throw error;
        }
    }

    // ================================
    // TOURNAMENT MATCHES
    // ================================

    async getTournamentMatches(tournamentId: number, round?: number): Promise<{ matches: TournamentMatch[]; grouped_matches: Record<number, TournamentMatch[]>; total_rounds: number }> {
        console.log(`🎮 RemoteTournamentService: Getting tournament ${tournamentId} matches${round ? ` (round ${round})` : ''}`);
        console.log(`   Called from:`, new Error().stack?.split('\n')[2]?.trim());
        
        try {
            const params = round ? `?round=${round}` : '';
            const response = await fetch(`${this.baseUrl}/api/game/tournament/${tournamentId}/matches${params}`, {
                headers: this.getAuthHeaders()
            });
            
            return await this.handleResponse<{ matches: TournamentMatch[]; grouped_matches: Record<number, TournamentMatch[]>; total_rounds: number }>(response);
        } catch (error) {
            console.error(`❌ Failed to get tournament ${tournamentId} matches:`, error);
            throw error;
        }
    }

    // ================================
    // GAME SESSIONS
    // ================================

    async createGameSession(sessionData: {
        player2_id?: string;
        game_mode: string;
        tournament_id?: number;
    }): Promise<GameSession> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/session`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(sessionData)
            });
            
            const result = await this.handleResponse<{ game_session: GameSession }>(response);
            return result.game_session;
        } catch (error) {
            console.error('Failed to create game session:', error);
            throw error;
        }
    }

    async getGameSession(sessionId: number): Promise<GameSession> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/session/${sessionId}`, {
                headers: this.getAuthHeaders()
            });
            
            const result = await this.handleResponse<{ game_session: GameSession }>(response);
            return result.game_session;
        } catch (error) {
            console.error('Failed to get game session:', error);
            throw error;
        }
    }

    async updateGameSession(sessionId: number, updates: {
        player1_score?: number;
        player2_score?: number;
        winner_id?: string;
        game_duration?: number;
        started_at?: string;
        finished_at?: string;
        status?: string;
        match_data?: any;
    }): Promise<GameSession> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/session/${sessionId}`, {
                method: 'PATCH',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updates)
            });
            
            const result = await this.handleResponse<{ game_session: GameSession }>(response);
            return result.game_session;
        } catch (error) {
            console.error('Failed to update game session:', error);
            throw error;
        }
    }

    // ================================
    // ANNOUNCEMENTS
    // ================================

    async getTournamentAnnouncements(tournamentId: number, unreadOnly: boolean = false): Promise<TournamentAnnouncement[]> {
        try {
            const params = unreadOnly ? '?unread_only=true' : '';
            const response = await fetch(`${this.baseUrl}/api/game/tournament/${tournamentId}/announcements${params}`, {
                headers: this.getAuthHeaders()
            });
            
            const result = await this.handleResponse<{ announcements: TournamentAnnouncement[] }>(response);
            return result.announcements;
        } catch (error) {
            console.error('Failed to get tournament announcements:', error);
            throw error;
        }
    }

    async markAnnouncementAsRead(announcementId: number): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/announcement/${announcementId}/read`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            
            await this.handleResponse<{}>(response);
        } catch (error) {
            console.error('Failed to mark announcement as read:', error);
            throw error;
        }
    }

    async createTournamentAnnouncement(tournamentId: number, announcementData: {
        title: string;
        message: string;
        target_users?: string[];
        priority?: 1 | 2 | 3;
    }): Promise<TournamentAnnouncement> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/tournament/${tournamentId}/announcement`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(announcementData)
            });
            
            const result = await this.handleResponse<{ announcement: TournamentAnnouncement }>(response);
            return result.announcement;
        } catch (error) {
            console.error('Failed to create tournament announcement:', error);
            throw error;
        }
    }

    // ================================
    // GAME INVITATIONS
    // ================================

    async sendGameInvitation(invitationData: {
        receiver_id: string;
        game_mode?: string;
        message?: string;
        tournament_id?: number;
    }): Promise<GameInvitation> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/invite`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(invitationData)
            });
            
            const result = await this.handleResponse<{ invitation: GameInvitation }>(response);
            showNotification('Game invitation sent!', 'success');
            return result.invitation;
        } catch (error) {
            console.error('Failed to send game invitation:', error);
            showError(`Failed to send invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async respondToGameInvitation(invitationId: number, response: 'accepted' | 'declined'): Promise<GameInvitation> {
        try {
            const apiResponse = await fetch(`${this.baseUrl}/api/game/invite/${invitationId}/respond`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ response })
            });
            
            const result = await this.handleResponse<{ invitation: GameInvitation }>(apiResponse);
            showNotification(`Invitation ${response}!`, response === 'accepted' ? 'success' : 'info');
            return result.invitation;
        } catch (error) {
            console.error('Failed to respond to invitation:', error);
            showError(`Failed to respond to invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async getGameInvitations(status?: string): Promise<GameInvitation[]> {
        try {
            const params = status ? `?status=${status}` : '';
            const response = await fetch(`${this.baseUrl}/api/game/invitations${params}`, {
                headers: this.getAuthHeaders()
            });
            
            const result = await this.handleResponse<{ invitations: GameInvitation[] }>(response);
            return result.invitations;
        } catch (error) {
            console.error('Failed to get game invitations:', error);
            throw error;
        }
    }

    // ================================
    // GAME ROOMS
    // ================================

    async joinGameRoom(roomId: string): Promise<{ room: any; game_session: GameSession }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/room/${roomId}/join`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            
            return await this.handleResponse<{ room: any; game_session: GameSession }>(response);
        } catch (error) {
            console.error('Failed to join game room:', error);
            throw error;
        }
    }

    // ================================
    // PLAYER STATISTICS
    // ================================

    async getPlayerStats(userId?: string): Promise<any> {
        try {
            const endpoint = userId ? `/api/game/stats/${userId}` : '/api/game/stats';
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: this.getAuthHeaders()
            });
            
            const result = await this.handleResponse<{ stats: any }>(response);
            return result.stats;
        } catch (error) {
            console.error('Failed to get player stats:', error);
            throw error;
        }
    }

    async getLeaderboard(limit: number = 100): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/leaderboard?limit=${limit}`, {
                headers: this.getAuthHeaders()
            });
            
            const result = await this.handleResponse<{ leaderboard: any[] }>(response);
            return result.leaderboard;
        } catch (error) {
            console.error('Failed to get leaderboard:', error);
            throw error;
        }
    }

    // ================================
    // GAME EVENTS
    // ================================

    async recordGameEvent(sessionId: number, eventData: {
        event_type: string;
        position_x?: number;
        position_y?: number;
        data?: any;
    }): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/session/${sessionId}/event`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(eventData)
            });
            
            await this.handleResponse<{}>(response);
        } catch (error) {
            console.error('Failed to record game event:', error);
            // Don't show error to user for game events as they're frequent
        }
    }

    async getGameEvents(sessionId: number): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/session/${sessionId}/events`, {
                headers: this.getAuthHeaders()
            });
            
            const result = await this.handleResponse<{ events: any[] }>(response);
            return result.events;
        } catch (error) {
            console.error('Failed to get game events:', error);
            throw error;
        }
    }

    // ================================
    // SEEDING MANAGEMENT
    // ================================

    async applySeeding(tournamentId: number, seedingMethod: 'random' | 'ranking' | 'manual', manualSeeds?: { user_id: string; seed_number: number }[]): Promise<TournamentParticipant[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/game/tournament/${tournamentId}/seeding`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    seeding_method: seedingMethod,
                    manual_seeds: manualSeeds
                })
            });
            
            const result = await this.handleResponse<{ participants: TournamentParticipant[] }>(response);
            showNotification('Tournament seeding applied!', 'success');
            return result.participants;
        } catch (error) {
            console.error('Failed to apply seeding:', error);
            showError(`Failed to apply seeding: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
}

// Export singleton instance
export const remoteTournamentService = new RemoteTournamentService();
export default remoteTournamentService;