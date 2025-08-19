import { Page } from '../router/Router';
import { showNotification, showError } from '../utils/ui';
import gameSocket from '../utils/gameSocket';

interface UserSearchResult {
    id: string;
    username: string;
    display_name: string;
    photo?: {
        filename: string;
        path: string;
    };
    game_stats?: {
        total_games: number;
        wins: number;
        losses: number;
        win_rate: number;
        ranking_points: number;
    };
}

interface GameInvitation {
    id: number;
    sender_id: string;
    receiver_id: string;
    game_mode: string;
    message: string;
    status: 'pending' | 'accepted' | 'declined';
    created_at: string;
    sender?: {
        username: string;
        display_name: string;
        photo?: any;
    };
}

export class OnlineMatchLobbyPage implements Page {
    public title = 'Online Match';
    public requiresAuth = true;

    private searchResults: UserSearchResult[] = [];
    private onlineUsers: UserSearchResult[] = [];
    private pendingInvitations: GameInvitation[] = [];
    private sentInvitations: GameInvitation[] = [];
    private searchTimeout: NodeJS.Timeout | null = null;

    public render(): string {
        return `
            <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900 flex flex-col">
                <!-- Header -->
                <div class="bg-slate-800 border-b border-slate-700 p-4">
                    <div class="flex items-center justify-between max-w-6xl mx-auto">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Game Menu</span>
                            </button>
                            <div class="h-6 w-px bg-slate-600"></div>
                            <h1 class="text-2xl font-bold text-white flex items-center">
                                <svg class="w-8 h-8 text-orange-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
                                </svg>
                                <span>Online Match</span>
                            </h1>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div class="text-sm text-gray-400">
                                Find opponents and challenge them to a match
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 p-6">
                    <div class="max-w-6xl mx-auto">
                        <div class="grid lg:grid-cols-3 gap-6">
                            <!-- Player Search -->
                            <div class="lg:col-span-2 space-y-6">
                                <!-- Search Section -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-xl font-semibold text-white">Find Players</h2>
                                        <button id="refreshOnlineButton" class="text-gray-300 hover:text-white transition-colors">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                            </svg>
                                        </button>
                                    </div>
                                    
                                    <div class="space-y-4">
                                        <!-- Search Input -->
                                        <div class="relative">
                                            <input 
                                                type="text" 
                                                id="userSearchInput"
                                                placeholder="Search players by username..."
                                                class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                            >
                                            <svg class="absolute right-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                            </svg>
                                        </div>

                                        <!-- Quick Tabs -->
                                        <div class="flex space-x-2">
                                            <button id="onlineUsersTab" class="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium transition-colors">
                                                Online Players
                                            </button>
                                            <button id="searchResultsTab" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">
                                                Search Results
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Players List -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 id="playersListTitle" class="text-xl font-semibold text-white">Online Players</h2>
                                        <div id="playersCount" class="text-sm text-gray-400">
                                            Loading...
                                        </div>
                                    </div>
                                    <div id="playersList" class="space-y-3">
                                        <div class="text-center text-gray-400 py-8">
                                            <div class="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                            <p>Loading players...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Sidebar -->
                            <div class="space-y-6">
                                <!-- Game Invitations -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-semibold text-white">Invitations</h2>
                                        <div id="invitationsBadge" class="px-2 py-1 bg-red-600 text-white text-xs rounded-full hidden">0</div>
                                    </div>
                                    
                                    <!-- Received Invitations -->
                                    <div class="mb-4">
                                        <h3 class="text-sm font-medium text-gray-300 mb-2">Received</h3>
                                        <div id="receivedInvitations" class="space-y-2">
                                            <div class="text-center text-gray-400 py-4 text-sm">
                                                No pending invitations
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Sent Invitations -->
                                    <div>
                                        <h3 class="text-sm font-medium text-gray-300 mb-2">Sent</h3>
                                        <div id="sentInvitations" class="space-y-2">
                                            <div class="text-center text-gray-400 py-4 text-sm">
                                                No sent invitations
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Quick Actions -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                                    <div class="space-y-3">
                                        <button id="randomMatchButton" class="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors">
                                            Find Random Match
                                        </button>
                                        <button id="refreshListButton" class="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                                            Refresh Players
                                        </button>
                                    </div>
                                </div>

                                <!-- Connection Status -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-lg font-semibold text-white mb-4">Connection</h2>
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-gray-300">Game Server</span>
                                            <div id="gameServerStatus" class="flex items-center">
                                                <div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                                                <span class="text-sm text-gray-400">Connecting...</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Game Invitation Modal -->
                <div id="invitationModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                    <div class="bg-slate-800 rounded-lg border border-slate-700 p-8 max-w-md w-full mx-4">
                        <h3 class="text-xl font-semibold text-white mb-6 text-center">Game Invitation</h3>
                        <div id="invitationContent" class="space-y-4">
                            <!-- Dynamic content -->
                        </div>
                        <div class="flex space-x-4 mt-8">
                            <button id="acceptInvitationButton" class="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                                Accept
                            </button>
                            <button id="declineInvitationButton" class="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                                Decline
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Notifications Container -->
                <div id="notifications" class="fixed top-20 right-4 z-40 pointer-events-none"></div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        this.bindElements();
        this.attachEventListeners();
        this.setupSocketEventListeners();
        
        // Initialize connection and load data
        gameSocket.connect();
        await this.loadOnlineUsers();
        await this.loadInvitations();
        
        this.updateConnectionStatus();
    }

    public cleanup(): void {
        this.removeEventListeners();
        this.removeSocketEventListeners();
        
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
    }

    private bindElements(): void {
        // Elements accessed by ID when needed
    }

    private attachEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', this.handleBackClick.bind(this));
        }

        const userSearchInput = document.getElementById('userSearchInput') as HTMLInputElement;
        if (userSearchInput) {
            userSearchInput.addEventListener('input', this.handleSearchInput.bind(this));
        }

        const onlineUsersTab = document.getElementById('onlineUsersTab');
        if (onlineUsersTab) {
            onlineUsersTab.addEventListener('click', () => this.switchTab('online'));
        }

        const searchResultsTab = document.getElementById('searchResultsTab');
        if (searchResultsTab) {
            searchResultsTab.addEventListener('click', () => this.switchTab('search'));
        }

        const refreshOnlineButton = document.getElementById('refreshOnlineButton');
        if (refreshOnlineButton) {
            refreshOnlineButton.addEventListener('click', this.loadOnlineUsers.bind(this));
        }

        const refreshListButton = document.getElementById('refreshListButton');
        if (refreshListButton) {
            refreshListButton.addEventListener('click', this.refreshCurrentList.bind(this));
        }

        const randomMatchButton = document.getElementById('randomMatchButton');
        if (randomMatchButton) {
            randomMatchButton.addEventListener('click', this.handleRandomMatch.bind(this));
        }

        const acceptInvitationButton = document.getElementById('acceptInvitationButton');
        if (acceptInvitationButton) {
            acceptInvitationButton.addEventListener('click', this.handleAcceptInvitation.bind(this));
        }

        const declineInvitationButton = document.getElementById('declineInvitationButton');
        if (declineInvitationButton) {
            declineInvitationButton.addEventListener('click', this.handleDeclineInvitation.bind(this));
        }
    }

    private removeEventListeners(): void {
        // Event listeners are automatically cleaned up when page is destroyed
    }

    private setupSocketEventListeners(): void {
        window.addEventListener('game_invitation', this.handleSocketGameInvitation.bind(this) as EventListener);
        window.addEventListener('game_invitation_response', this.handleSocketInvitationResponse.bind(this) as EventListener);
        window.addEventListener('game_ready', this.handleSocketGameReady.bind(this) as EventListener);
    }

    private removeSocketEventListeners(): void {
        window.removeEventListener('game_invitation', this.handleSocketGameInvitation.bind(this) as EventListener);
        window.removeEventListener('game_invitation_response', this.handleSocketInvitationResponse.bind(this) as EventListener);
        window.removeEventListener('game_ready', this.handleSocketGameReady.bind(this) as EventListener);
    }

    private handleBackClick(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: '/game' }
        });
        window.dispatchEvent(event);
    }

    private async handleSearchInput(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const query = input.value.trim();

        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        if (query.length < 2) {
            this.searchResults = [];
            this.switchTab('online');
            return;
        }

        this.searchTimeout = setTimeout(async () => {
            await this.searchUsers(query);
            this.switchTab('search');
        }, 300);
    }

    private async searchUsers(query: string): Promise<void> {
        try {
            const response = await fetch(`https://localhost:3004/api/game/users/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.searchResults = data.users || [];
                this.updatePlayersList();
            }
        } catch (error) {
            console.error('Failed to search users:', error);
            showError('Failed to search users');
        }
    }

    private async loadOnlineUsers(): Promise<void> {
        try {
            const response = await fetch('https://localhost:3004/api/game/users/online', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.onlineUsers = data.users || [];
                this.updatePlayersList();
            }
        } catch (error) {
            console.error('Failed to load online users:', error);
            this.onlineUsers = [];
            this.updatePlayersList();
        }
    }

    private async loadInvitations(): Promise<void> {
        try {
            const response = await fetch('https://localhost:3004/api/game/invitations', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const invitations = data.invitations || [];
                
                const currentUserId = JSON.parse(localStorage.getItem('userData') || '{}').id;
                this.pendingInvitations = invitations.filter((inv: GameInvitation) => 
                    inv.receiver_id === currentUserId && inv.status === 'pending'
                );
                this.sentInvitations = invitations.filter((inv: GameInvitation) => 
                    inv.sender_id === currentUserId && inv.status === 'pending'
                );
                
                this.updateInvitationsDisplay();
            }
        } catch (error) {
            console.error('Failed to load invitations:', error);
        }
    }

    private switchTab(tab: 'online' | 'search'): void {
        const onlineTab = document.getElementById('onlineUsersTab');
        const searchTab = document.getElementById('searchResultsTab');
        const titleElement = document.getElementById('playersListTitle');

        if (tab === 'online') {
            onlineTab?.classList.remove('bg-slate-700', 'hover:bg-slate-600');
            onlineTab?.classList.add('bg-orange-600');
            searchTab?.classList.remove('bg-orange-600');
            searchTab?.classList.add('bg-slate-700', 'hover:bg-slate-600');
            
            if (titleElement) titleElement.textContent = 'Online Players';
            this.updatePlayersList();
        } else {
            searchTab?.classList.remove('bg-slate-700', 'hover:bg-slate-600');
            searchTab?.classList.add('bg-orange-600');
            onlineTab?.classList.remove('bg-orange-600');
            onlineTab?.classList.add('bg-slate-700', 'hover:bg-slate-600');
            
            if (titleElement) titleElement.textContent = 'Search Results';
            this.updatePlayersList();
        }
    }

    private getCurrentTabPlayers(): UserSearchResult[] {
        const searchTab = document.getElementById('searchResultsTab');
        return searchTab?.classList.contains('bg-orange-600') ? this.searchResults : this.onlineUsers;
    }

    private updatePlayersList(): void {
        const playersListElement = document.getElementById('playersList');
        const playersCountElement = document.getElementById('playersCount');
        
        if (!playersListElement) return;

        const players = this.getCurrentTabPlayers();
        
        if (playersCountElement) {
            playersCountElement.textContent = `${players.length} players`;
        }

        if (players.length === 0) {
            const isSearchTab = document.getElementById('searchResultsTab')?.classList.contains('bg-orange-600');
            playersListElement.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <p>${isSearchTab ? 'No players found' : 'No players online'}</p>
                </div>
            `;
            return;
        }

        playersListElement.innerHTML = players.map((player: UserSearchResult) => `
            <div class="flex items-center justify-between p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-semibold">
                        ${player.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="text-white font-medium">${player.display_name || player.username}</div>
                        <div class="text-xs text-gray-400">
                            ${player.game_stats ? 
                                `${player.game_stats.total_games} games • ${player.game_stats.win_rate}% win rate • ${player.game_stats.ranking_points} pts` 
                                : 'No game history'
                            }
                        </div>
                    </div>
                </div>
                <button 
                    class="challenge-button px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors"
                    data-user-id="${player.id}"
                    data-username="${player.username}"
                >
                    Challenge
                </button>
            </div>
        `).join('');

        // Add event listeners to challenge buttons
        playersListElement.querySelectorAll('.challenge-button').forEach(button => {
            button.addEventListener('click', this.handleChallenge.bind(this));
        });
    }

    private updateInvitationsDisplay(): void {
        const receivedElement = document.getElementById('receivedInvitations');
        const sentElement = document.getElementById('sentInvitations');
        const badgeElement = document.getElementById('invitationsBadge');

        if (receivedElement) {
            if (this.pendingInvitations.length === 0) {
                receivedElement.innerHTML = `
                    <div class="text-center text-gray-400 py-4 text-sm">
                        No pending invitations
                    </div>
                `;
            } else {
                receivedElement.innerHTML = this.pendingInvitations.map((inv: GameInvitation) => `
                    <div class="p-3 bg-slate-700 rounded-lg border border-slate-600">
                        <div class="flex items-center justify-between mb-2">
                            <div class="text-white text-sm font-medium">${inv.sender?.display_name || inv.sender?.username || 'Unknown'}</div>
                        </div>
                        <div class="text-xs text-gray-400 mb-3">${inv.message}</div>
                        <div class="flex space-x-2">
                            <button 
                                class="accept-invitation-btn flex-1 py-1 px-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                                data-invitation-id="${inv.id}"
                            >
                                Accept
                            </button>
                            <button 
                                class="decline-invitation-btn flex-1 py-1 px-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                                data-invitation-id="${inv.id}"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                `).join('');

                // Add event listeners
                receivedElement.querySelectorAll('.accept-invitation-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const invitationId = (e.target as HTMLElement).getAttribute('data-invitation-id');
                        this.respondToInvitation(parseInt(invitationId!), 'accepted');
                    });
                });

                receivedElement.querySelectorAll('.decline-invitation-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const invitationId = (e.target as HTMLElement).getAttribute('data-invitation-id');
                        this.respondToInvitation(parseInt(invitationId!), 'declined');
                    });
                });
            }
        }

        if (sentElement) {
            if (this.sentInvitations.length === 0) {
                sentElement.innerHTML = `
                    <div class="text-center text-gray-400 py-4 text-sm">
                        No sent invitations
                    </div>
                `;
            } else {
                sentElement.innerHTML = this.sentInvitations.map((inv: GameInvitation) => `
                    <div class="p-3 bg-slate-700 rounded-lg">
                        <div class="text-white text-sm font-medium mb-1">${inv.receiver_id}</div>
                        <div class="text-xs text-gray-400">Waiting for response...</div>
                    </div>
                `).join('');
            }
        }

        if (badgeElement) {
            if (this.pendingInvitations.length > 0) {
                badgeElement.textContent = this.pendingInvitations.length.toString();
                badgeElement.classList.remove('hidden');
            } else {
                badgeElement.classList.add('hidden');
            }
        }
    }

    private async handleChallenge(event: Event): Promise<void> {
        const button = event.target as HTMLElement;
        const userId = button.getAttribute('data-user-id');
        const username = button.getAttribute('data-username');

        if (!userId || !username) return;

        try {
            const response = await fetch('https://localhost:3004/api/game/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    receiver_id: userId,
                    game_mode: 'remote',
                    message: `Challenge you to a Pong match!`
                })
            });

            if (response.ok) {
                showNotification(`Game invitation sent to ${username}!`, 'success');
                await this.loadInvitations();
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to send invitation');
            }
        } catch (error) {
            console.error('Failed to send invitation:', error);
            showError('Failed to send invitation');
        }
    }

    private async respondToInvitation(invitationId: number, response: 'accepted' | 'declined'): Promise<void> {
        try {
            const apiResponse = await fetch(`https://localhost:3004/api/game/invite/${invitationId}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ response })
            });

            if (apiResponse.ok) {
                showNotification(`Invitation ${response}!`, response === 'accepted' ? 'success' : 'info');
                await this.loadInvitations();
            } else {
                const error = await apiResponse.json();
                showError(error.error || 'Failed to respond to invitation');
            }
        } catch (error) {
            console.error('Failed to respond to invitation:', error);
            showError('Failed to respond to invitation');
        }
    }

    private async refreshCurrentList(): Promise<void> {
        const isOnlineTab = document.getElementById('onlineUsersTab')?.classList.contains('bg-orange-600');
        if (isOnlineTab) {
            await this.loadOnlineUsers();
        } else {
            const searchInput = document.getElementById('userSearchInput') as HTMLInputElement;
            if (searchInput.value.trim().length >= 2) {
                await this.searchUsers(searchInput.value.trim());
            }
        }
    }

    private async handleRandomMatch(): Promise<void> {
        const onlineUsers = this.onlineUsers.filter(user => user.id !== JSON.parse(localStorage.getItem('userData') || '{}').id);
        
        if (onlineUsers.length === 0) {
            showError('No online players available for random match');
            return;
        }

        const randomUser = onlineUsers[Math.floor(Math.random() * onlineUsers.length)];
        const mockEvent = {
            target: {
                getAttribute: (attr: string) => {
                    if (attr === 'data-user-id') return randomUser.id;
                    if (attr === 'data-username') return randomUser.username;
                    return null;
                }
            } as HTMLElement
        } as unknown as Event;
        
        await this.handleChallenge(mockEvent);
    }

    private handleSocketGameInvitation(event: Event): void {
        const { invitation, sender } = (event as CustomEvent).detail;
        showNotification(`${sender.username} challenged you to a match!`, 'info', 0);
        this.loadInvitations();
    }

    private handleSocketInvitationResponse(event: Event): void {
        const { response, responder } = (event as CustomEvent).detail;
        if (response === 'accepted') {
            showNotification(`${responder.username} accepted your challenge!`, 'success');
        } else {
            showNotification(`${responder.username} declined your challenge`, 'info');
        }
        this.loadInvitations();
    }

    private handleSocketGameReady(event: Event): void {
        const { game_session, room_id } = (event as CustomEvent).detail;
        showNotification('Game is ready! Joining match...', 'success');
        
        // Navigate to the game
        setTimeout(() => {
            const event = new CustomEvent('navigate', {
                detail: { path: `/game/remote/match/${game_session.id}?room=${room_id}` }
            });
            window.dispatchEvent(event);
        }, 1500);
    }

    private handleAcceptInvitation(): void {
        // This method will be implemented when needed
    }

    private handleDeclineInvitation(): void {
        // This method will be implemented when needed
    }

    private updateConnectionStatus(): void {
        const statusElement = document.getElementById('gameServerStatus');
        if (!statusElement) return;

        if (gameSocket.isConnected()) {
            statusElement.innerHTML = `
                <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span class="text-sm text-green-400">Connected</span>
            `;
        } else {
            statusElement.innerHTML = `
                <div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span class="text-sm text-red-400">Disconnected</span>
            `;
        }
    }
}