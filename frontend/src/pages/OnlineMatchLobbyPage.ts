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
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    created_at: string;
    expires_at?: string;  // When the invitation expires
    sender_username?: string;  // Added from backend
    receiver_username?: string; // Added from backend
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
    
    // Store bound event handler references for proper cleanup
    private boundHandlers = {
        gameInvitation: this.handleSocketGameInvitation.bind(this),
        gameInvitationResponse: this.handleSocketInvitationResponse.bind(this),
        gameReady: this.handleSocketGameReady.bind(this)
    };

    public render(): string {
        return `
            <div class="min-h-screen bg-black relative overflow-hidden flex flex-col">
                <!-- Tron-inspired animated background -->
                <div class="absolute inset-0 opacity-30">
                    <!-- Animated grid -->
                    <div class="absolute inset-0" style="background-image: 
                        linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px);
                        background-size: 40px 40px; 
                        animation: grid-move 20s linear infinite;">
                    </div>
                    
                    <!-- Glowing circuit lines -->
                    <div class="absolute inset-0">
                        <div class="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-cyan-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite;"></div>
                        <div class="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-blue-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite; animation-delay: 1.5s;"></div>
                        <div class="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-purple-500 to-transparent shadow-purple-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite; animation-delay: 0.5s;"></div>
                        <div class="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-pink-500 to-transparent shadow-pink-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite; animation-delay: 2s;"></div>
                    </div>
                    
                    <!-- Floating particles -->
                    <div class="absolute inset-0">
                        <div class="absolute w-1 h-1 bg-cyan-400 rounded-full animate-ping" style="top: 20%; left: 15%; animation-delay: 0s;"></div>
                        <div class="absolute w-1 h-1 bg-blue-400 rounded-full animate-ping" style="top: 60%; left: 80%; animation-delay: 1s;"></div>
                        <div class="absolute w-1 h-1 bg-purple-400 rounded-full animate-ping" style="top: 40%; left: 60%; animation-delay: 2s;"></div>
                        <div class="absolute w-1 h-1 bg-pink-400 rounded-full animate-ping" style="top: 80%; left: 30%; animation-delay: 1.5s;"></div>
                    </div>
                    
                    <!-- Hexagonal pattern overlay -->
                    <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle at 25px 25px, rgba(0, 255, 255, 0.2) 2px, transparent 2px); background-size: 50px 50px;"></div>
                </div>
                
                <style>
                    @keyframes grid-move {
                        0% { transform: translate(0, 0); }
                        100% { transform: translate(40px, 40px); }
                    }
                    
                    @keyframes line-glow {
                        0%, 100% { opacity: 0.3; box-shadow: 0 0 5px currentColor; }
                        50% { opacity: 1; box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
                    }
                    
                    .tron-glow {
                        box-shadow: 0 0 10px rgba(0, 255, 255, 0.3), 0 0 20px rgba(0, 255, 255, 0.1);
                    }
                    
                    .tron-border {
                        border: 1px solid rgba(0, 255, 255, 0.3);
                        position: relative;
                    }
                    
                    .tron-border::before {
                        content: '';
                        position: absolute;
                        top: -1px;
                        left: -1px;
                        right: -1px;
                        bottom: -1px;
                        background: linear-gradient(45deg, transparent, rgba(0, 255, 255, 0.1), transparent);
                        z-index: -1;
                        border-radius: inherit;
                    }
                </style>
                
                <!-- Header -->
                <div class="bg-slate-900/90 backdrop-blur-sm border-b border-cyan-500/30 p-4 relative z-10 tron-glow flex-shrink-0">
                    <div class="flex items-center justify-between max-w-6xl mx-auto">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors tron-glow">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Game Menu</span>
                            </button>
                            <div class="h-6 w-px bg-cyan-500/30"></div>
                            <h1 class="text-2xl font-bold text-cyan-400 flex items-center">
                                <svg class="w-8 h-8 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
                                </svg>
                                <span>Online Match</span>
                            </h1>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div class="text-sm text-cyan-300">
                                Find opponents and challenge them to a match
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 p-6 relative z-10">
                    <div class="max-w-6xl mx-auto">
                        <div class="grid lg:grid-cols-3 gap-6">
                            <!-- Player Search -->
                            <div class="lg:col-span-2 space-y-6">
                                <!-- Search Section -->
                                <div class="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-xl font-semibold text-cyan-400">Find Players</h2>
                                        <button id="refreshOnlineButton" class="text-cyan-300 hover:text-cyan-200 transition-colors tron-glow">
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
                                                class="w-full px-4 py-3 bg-slate-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all tron-glow"
                                            >
                                            <svg class="absolute right-3 top-3 w-5 h-5 text-cyan-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                            </svg>
                                        </div>

                                        <!-- Quick Tabs -->
                                        <div class="flex space-x-2">
                                            <button id="onlineUsersTab" class="px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-700 text-white rounded-lg font-medium transition-all tron-glow">
                                                Online Players
                                            </button>
                                            <button id="searchResultsTab" class="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/70 border border-cyan-500/30 text-cyan-300 rounded-lg font-medium transition-all tron-glow">
                                                Search Results
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Players List -->
                                <div class="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 id="playersListTitle" class="text-xl font-semibold text-cyan-400">Online Players</h2>
                                        <div id="playersCount" class="text-sm text-cyan-300">
                                            Loading...
                                        </div>
                                    </div>
                                    <div id="playersList" class="space-y-3">
                                        <div class="text-center text-cyan-400/70 py-8">
                                            <div class="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                            <p>Loading players...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Sidebar -->
                            <div class="space-y-6">
                                <!-- Game Invitations -->
                                <div class="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-semibold text-cyan-400">Invitations</h2>
                                        <div id="invitationsBadge" class="px-2 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full hidden tron-glow">0</div>
                                    </div>
                                    
                                    <!-- Received Invitations -->
                                    <div class="mb-4">
                                        <h3 class="text-sm font-medium text-cyan-300 mb-2">Received</h3>
                                        <div id="receivedInvitations" class="space-y-2">
                                            <div class="text-center text-cyan-400/70 py-4 text-sm">
                                                No pending invitations
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Sent Invitations -->
                                    <div>
                                        <h3 class="text-sm font-medium text-cyan-300 mb-2">Sent</h3>
                                        <div id="sentInvitations" class="space-y-2">
                                            <div class="text-center text-cyan-400/70 py-4 text-sm">
                                                No sent invitations
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Quick Actions -->
                                <div class="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <h2 class="text-lg font-semibold text-cyan-400 mb-4">Quick Actions</h2>
                                    <div class="space-y-3">
                                        <button id="randomMatchButton" class="w-full py-2 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-lg transition-all tron-glow">
                                            Find Random Match
                                        </button>
                                        <button id="refreshListButton" class="w-full py-2 bg-slate-800/50 hover:bg-slate-700/70 border border-cyan-500/30 text-cyan-300 rounded-lg transition-all tron-glow">
                                            Refresh Players
                                        </button>
                                    </div>
                                </div>

                                <!-- Connection Status -->
                                <div class="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <h2 class="text-lg font-semibold text-cyan-400 mb-4">Connection</h2>
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-cyan-300">Game Server</span>
                                            <div id="gameServerStatus" class="flex items-center">
                                                <div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                                                <span class="text-sm text-cyan-400/70">Connecting...</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Game Invitation Modal -->
                <div id="invitationModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 hidden">
                    <div class="bg-slate-900/90 backdrop-blur-md rounded-lg border border-cyan-500/50 p-8 max-w-md w-full mx-4 tron-border tron-glow">
                        <h3 class="text-xl font-semibold text-cyan-400 mb-6 text-center">Game Invitation</h3>
                        <div id="invitationContent" class="space-y-4">
                            <!-- Dynamic content -->
                        </div>
                        <div class="flex space-x-4 mt-8">
                            <button id="acceptInvitationButton" class="flex-1 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white rounded-lg transition-all tron-glow">
                                Accept
                            </button>
                            <button id="declineInvitationButton" class="flex-1 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-lg transition-all tron-glow">
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
        this.attachEventListeners();
        this.setupSocketEventListeners();
        
        // Initialize connection and load data
        gameSocket.connect();
        
        // Ensure user is in their user room for receiving invitations (after connection)
        setTimeout(() => {
            gameSocket.rejoinUserRoom();
        }, 1000);
        
        await this.loadOnlineUsers();
        
        await this.loadInvitations();
        
        this.updateConnectionStatus();
    }

    public cleanup(): void {
        this.removeSocketEventListeners();
        this.removeEventListeners();
        
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
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

    }

    private removeEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.removeEventListener('click', this.handleBackClick.bind(this));
        }

        const userSearchInput = document.getElementById('userSearchInput') as HTMLInputElement;
        if (userSearchInput) {
            userSearchInput.removeEventListener('input', this.handleSearchInput.bind(this));
        }

        const onlineUsersTab = document.getElementById('onlineUsersTab');
        if (onlineUsersTab) {
            onlineUsersTab.removeEventListener('click', () => this.switchTab('online'));
        }

        const searchResultsTab = document.getElementById('searchResultsTab');
        if (searchResultsTab) {
            searchResultsTab.removeEventListener('click', () => this.switchTab('search'));
        }

        const refreshOnlineButton = document.getElementById('refreshOnlineButton');
        if (refreshOnlineButton) {
            refreshOnlineButton.removeEventListener('click', this.loadOnlineUsers.bind(this));
        }

        const refreshListButton = document.getElementById('refreshListButton');
        if (refreshListButton) {
            refreshListButton.removeEventListener('click', this.refreshCurrentList.bind(this));
        }

        const randomMatchButton = document.getElementById('randomMatchButton');
        if (randomMatchButton) {
            randomMatchButton.removeEventListener('click', this.handleRandomMatch.bind(this));
        }

        // Remove dynamically added challenge button listeners
        const challengeButtons = document.querySelectorAll('.challenge-button');
        challengeButtons.forEach(button => {
            button.removeEventListener('click', this.handleChallenge.bind(this));
        });

        // Remove dynamically added invitation button listeners
        const acceptButtons = document.querySelectorAll('.accept-invitation-btn');
        acceptButtons.forEach(button => {
            button.removeEventListener('click', (e) => {
                const invitationId = (e.target as HTMLElement).getAttribute('data-invitation-id');
                this.respondToInvitation(parseInt(invitationId!), 'accepted');
            });
        });

        const declineButtons = document.querySelectorAll('.decline-invitation-btn');
        declineButtons.forEach(button => {
            button.removeEventListener('click', (e) => {
                const invitationId = (e.target as HTMLElement).getAttribute('data-invitation-id');
                this.respondToInvitation(parseInt(invitationId!), 'declined');
            });
        });
    }

    private setupSocketEventListeners(): void {
        window.addEventListener('game_invitation', this.boundHandlers.gameInvitation as EventListener);
        window.addEventListener('game_invitation_response', this.boundHandlers.gameInvitationResponse as EventListener);
        window.addEventListener('game_ready', this.boundHandlers.gameReady as EventListener);
    }

    private removeSocketEventListeners(): void {
        window.removeEventListener('game_invitation', this.boundHandlers.gameInvitation as EventListener);
        window.removeEventListener('game_invitation_response', this.boundHandlers.gameInvitationResponse as EventListener);
        window.removeEventListener('game_ready', this.boundHandlers.gameReady as EventListener);
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
            const url = `/api/game/users/search?q=${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                this.searchResults = data.users || [];
                
                this.updatePlayersList();
            } else {
                const errorText = await response.text();
                console.error(`Search request failed: ${response.status} - ${errorText}`);
                showError('Failed to search users');
            }
        } catch (error) {
            console.error('Search users error:', error);
            showError('Failed to search users');
        }
    }

    private async loadOnlineUsers(): Promise<void> {
        try {
            const url = '/api/game/users/online';
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.onlineUsers = data.users || [];
                this.updatePlayersList();
            } else {
                const errorText = await response.text();
                console.error(`Failed to load online users: ${response.status} - ${errorText}`);
                this.onlineUsers = [];
                this.updatePlayersList();
            }
        } catch (error) {
            console.error('Load online users error:', error);
            this.onlineUsers = [];
            this.updatePlayersList();
        }
    }

    private async loadInvitations(): Promise<void> {
        try {
            const url = '/api/game/invitations';
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const invitations = data.invitations || [];
                
                const currentUserId = JSON.parse(localStorage.getItem('userData') || '{}').id;
                
                // Convert currentUserId to string for comparison
                const currentUserIdStr = String(currentUserId);
                const now = new Date();
                
                // Helper function to check if invitation is not expired
                const isNotExpired = (inv: GameInvitation) => {
                    if (!inv.expires_at) return true; // No expiry date means it doesn't expire
                    const expiryDate = new Date(inv.expires_at);
                    return expiryDate > now;
                };
                
                this.pendingInvitations = invitations.filter((inv: GameInvitation) => 
                    inv.receiver_id === currentUserIdStr && 
                    inv.status === 'pending' && 
                    isNotExpired(inv)
                );
                this.sentInvitations = invitations.filter((inv: GameInvitation) => 
                    inv.sender_id === currentUserIdStr && 
                    inv.status === 'pending' && 
                    isNotExpired(inv)
                );
                
                this.updateInvitationsDisplay();
            } else {
                const errorText = await response.text();
                console.error(`Failed to load invitations: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error('Load invitations error:', error);
        }
    }

    private switchTab(tab: 'online' | 'search'): void {
        const onlineTab = document.getElementById('onlineUsersTab');
        const searchTab = document.getElementById('searchResultsTab');
        const titleElement = document.getElementById('playersListTitle');

        if (tab === 'online') {
            onlineTab?.classList.remove('bg-slate-800/50', 'hover:bg-slate-700/70', 'border', 'border-cyan-500/30', 'text-cyan-300');
            onlineTab?.classList.add('bg-gradient-to-r', 'from-cyan-600', 'to-cyan-700', 'text-white');
            searchTab?.classList.remove('bg-gradient-to-r', 'from-cyan-600', 'to-cyan-700', 'text-white');
            searchTab?.classList.add('bg-slate-800/50', 'hover:bg-slate-700/70', 'border', 'border-cyan-500/30', 'text-cyan-300');
            
            if (titleElement) titleElement.textContent = 'Online Players';
            this.updatePlayersList();
        } else {
            searchTab?.classList.remove('bg-slate-800/50', 'hover:bg-slate-700/70', 'border', 'border-cyan-500/30', 'text-cyan-300');
            searchTab?.classList.add('bg-gradient-to-r', 'from-cyan-600', 'to-cyan-700', 'text-white');
            onlineTab?.classList.remove('bg-gradient-to-r', 'from-cyan-600', 'to-cyan-700', 'text-white');
            onlineTab?.classList.add('bg-slate-800/50', 'hover:bg-slate-700/70', 'border', 'border-cyan-500/30', 'text-cyan-300');
            
            if (titleElement) titleElement.textContent = 'Search Results';
            this.updatePlayersList();
        }
    }

    private getCurrentTabPlayers(): UserSearchResult[] {
        const searchTab = document.getElementById('searchResultsTab');
        return searchTab?.classList.contains('from-cyan-600') ? this.searchResults : this.onlineUsers;
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
            const isSearchTab = document.getElementById('searchResultsTab')?.classList.contains('from-cyan-600');
            playersListElement.innerHTML = `
                <div class="text-center text-cyan-400/70 py-8">
                    <p>${isSearchTab ? 'No players found' : 'No players online'}</p>
                </div>
            `;
            return;
        }

        playersListElement.innerHTML = players.map((player: UserSearchResult) => {
            // Handle multiple possible ID field names from the API response
            const playerId = player.id || (player as any).user_id || (player as any)._id || '';
            
            return `
                <div class="flex items-center justify-between p-4 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-cyan-500/30 hover:bg-slate-800/70 transition-all tron-border tron-glow">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-full flex items-center justify-center text-white font-semibold tron-glow">
                            ${player.username?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <div class="text-white font-medium">${player.display_name || player.username}</div>
                            <div class="text-xs text-cyan-300">
                                ${player.game_stats ? 
                                    `${player.game_stats.total_games} games • ${player.game_stats.win_rate}% win rate • ${player.game_stats.ranking_points} pts` 
                                    : 'No game history'
                                }
                            </div>
                        </div>
                    </div>
                    <button 
                        class="challenge-button px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white text-sm rounded-lg transition-all tron-glow"
                        data-user-id="${playerId}"
                        data-username="${player.username}"
                        ${!playerId ? 'disabled title="User ID not available"' : ''}
                    >
                        Challenge
                    </button>
                </div>
            `;
        }).join('');

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
                    <div class="text-center text-cyan-400/70 py-4 text-sm">
                        No pending invitations
                    </div>
                `;
            } else {
                receivedElement.innerHTML = this.pendingInvitations.map((inv: GameInvitation) => `
                    <div class="p-3 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-cyan-500/30 tron-border tron-glow">
                        <div class="flex items-center justify-between mb-2">
                            <div class="text-white text-sm font-medium">${inv.sender_username || inv.sender?.username || inv.sender?.display_name || 'Unknown'}</div>
                        </div>
                        <div class="text-xs text-cyan-300 mb-3">${inv.message}</div>
                        <div class="flex space-x-2">
                            <button 
                                class="accept-invitation-btn flex-1 py-1 px-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white text-xs rounded transition-all tron-glow"
                                data-invitation-id="${inv.id}"
                            >
                                Accept
                            </button>
                            <button 
                                class="decline-invitation-btn flex-1 py-1 px-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white text-xs rounded transition-all tron-glow"
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
                    <div class="text-center text-cyan-400/70 py-4 text-sm">
                        No sent invitations
                    </div>
                `;
            } else {
                sentElement.innerHTML = this.sentInvitations.map((inv: GameInvitation) => `
                    <div class="p-3 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-cyan-500/30 tron-border tron-glow">
                        <div class="text-white text-sm font-medium mb-1">${inv.receiver_username || 'Unknown'}</div>
                        <div class="text-xs text-cyan-300">Waiting for response...</div>
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

        if (!userId || !username || userId === 'undefined') {
            console.error('Missing or invalid user ID/username for challenge');
            console.error('Current players data:', this.getCurrentTabPlayers());
            return;
        }

        try {
            const invitationData = {
                receiver_id: userId,
                game_mode: 'remote',
                message: `Challenge you to a Pong match!`
            };
            
            const response = await fetch('/api/game/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(invitationData)
            });

            if (response.ok) {
                await response.json();
                showNotification(`Game invitation sent to ${username}!`, 'success');
                await this.loadInvitations();
            } else {
                const error = await response.json();
                console.error('Challenge failed:', error);
                showError(error.error || 'Failed to send invitation');
            }
        } catch (error) {
            console.error('Challenge error:', error);
            showError('Failed to send invitation');
        }
    }

    private async respondToInvitation(invitationId: number, response: 'accepted' | 'declined'): Promise<void> {
        try {
            const responseData = { response };
            
            const apiResponse = await fetch(`/api/game/invite/${invitationId}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(responseData)
            });

            if (apiResponse.ok) {
                await apiResponse.json();
                showNotification(`Invitation ${response}!`, response === 'accepted' ? 'success' : 'info');
                await this.loadInvitations();
            } else {
                const error = await apiResponse.json();
                console.error('Invitation response failed:', error);
                showError(error.error || 'Failed to respond to invitation');
            }
        } catch (error) {
            console.error('Respond to invitation error:', error);
            showError('Failed to respond to invitation');
        }
    }

    private async refreshCurrentList(): Promise<void> {
        const isOnlineTab = document.getElementById('onlineUsersTab')?.classList.contains('from-cyan-600');
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
        const onlineUsers = this.onlineUsers.filter(user => String(user.id) !== String(JSON.parse(localStorage.getItem('userData') || '{}').id));
        
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
        const eventDetail = (event as CustomEvent).detail;
        
        const { sender } = eventDetail;
        
        if (sender && sender.username) {
            // Notification logic here if needed
        } else {
            console.warn('Missing sender information in invitation');
            showNotification('You received a game invitation!', 'info', 0);
        }
        this.loadInvitations();
    }

    private handleSocketInvitationResponse(event: Event): void {
        const eventDetail = (event as CustomEvent).detail;
        
        const { response, responder } = eventDetail;
        
        if (responder && responder.username) {
            if (response === 'accepted') {
                showNotification(`${responder.username} accepted your challenge!`, 'success');
            } else {
                showNotification(`${responder.username} declined your challenge`, 'info');
            }
        } else {
            console.warn('Missing responder information');
            showNotification(`Your invitation was ${response}`, response === 'accepted' ? 'success' : 'info');
        }
        this.loadInvitations();
    }

    private handleSocketGameReady(event: Event): void {
        const eventDetail = (event as CustomEvent).detail;
        
        const { game_session, room_id } = eventDetail;
        
        if (!game_session || !room_id) {
            console.error('Missing game session or room ID in game ready event');
            showNotification('Game setup incomplete. Please try again.', 'error');
            return;
        }
        
        const navigationPath = `/game/remote/match/${game_session.id}?room=${room_id}`;
        
        // Navigate to the game
        setTimeout(() => {
            const navigationEvent = new CustomEvent('navigate', {
                detail: { path: navigationPath }
            });
            window.dispatchEvent(navigationEvent);
        }, 1500);
    }


    private updateConnectionStatus(): void {
        const statusElement = document.getElementById('gameServerStatus');
        if (!statusElement) {
            console.warn('Game server status element not found');
            return;
        }

        const isConnected = gameSocket.isConnected();

        if (isConnected) {
            statusElement.innerHTML = `
                <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span class="text-sm text-cyan-400">Connected</span>
            `;
        } else {
            statusElement.innerHTML = `
                <div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span class="text-sm text-cyan-400/70">Disconnected</span>
            `;
        }
    }
}