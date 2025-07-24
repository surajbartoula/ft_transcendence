// pages/DashboardPage.ts - Dashboard page with all related functionality
import { Page } from '../router/Router';
import { User } from '../utils/auth';
import { fetchUserGameData } from '../utils/dashboard';
import { showError, showNotification } from '../utils/ui';
import { API_CONFIG } from '../config';

export class DashboardPage implements Page {
    public title = 'Dashboard';
    public requiresAuth = true;
    
    private currentUser: User | null = null;
    private gameData: any = null;
    private playButton: HTMLElement | null = null;
    private modalOverlay: HTMLElement | null = null;

    public render(): string {
        return `
            <div class="fixed inset-0 flex h-screen bg-slate-900">
                <!-- Sidebar -->
                <div class="w-64 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
                    <div class="p-6 border-b border-slate-700">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                <span class="text-white font-bold text-lg">G</span>
                            </div>
                            <h1 class="text-xl font-bold text-blue-400">GameHub</h1>
                        </div>
                    </div>
                    
                    <nav class="p-4 space-y-2 flex-1">
                        <a href="#" id="playButton" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg bg-blue-600 text-white">
                            <span>🎮</span>
                            <span>Play</span>
                        </a>
                        <a href="#" data-route="/dashboard/profile" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
                            <span>👤</span>
                            <span>Profile</span>
                        </a>
                        <a href="#" data-route="/dashboard/leaderboard" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
                            <span>🏆</span>
                            <span>Leaderboard</span>
                        </a>
                        <a href="#" data-route="/dashboard/friends" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
                            <span>👥</span>
                            <span>Friends</span>
                        </a>
                        <a href="#" data-route="/dashboard/settings" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
                            <span>⚙️</span>
                            <span>Settings</span>
                        </a>
                        <a href="#" data-route="/chat" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
                            <span>💬</span>
                            <span>Chat</span>
                        </a>
                        <a href="#" id="logoutBtn" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors">
                            <span>🚪</span>
                            <span>Logout</span>
                        </a>
                    </nav>
                </div>

                <!-- Main Content -->
                <div class="flex-1 p-8 overflow-y-auto">
                    <!-- User Profile Header -->
                    <div class="flex items-center justify-between mb-8">
                        <div class="flex items-center space-x-4">
                            <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xl font-bold" id="userAvatar">
                                <div class="loading-spinner"></div>
                            </div>
                            <div>
                                <h2 class="text-2xl text-white font-bold" id="userName">Loading...</h2>
                                <p class="text-gray-400" id="userHandle">@loading</p>
                                <div class="flex items-center space-x-2 mt-1">
                                    <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span class="text-sm text-green-400">Online</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-3xl font-bold text-yellow-500" id="userRating">0</div>
                            <div class="text-sm text-gray-400">Rating</div>
                        </div>
                    </div>

                    <!-- Game Statistics -->
                    <div class="mb-8">
                        <h3 class="text-xl font-semibold text-white mb-4">Game Statistics</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="bg-slate-700 rounded-lg p-6 card-hover">
                                <div class="text-3xl font-bold text-blue-400" id="gamesPlayed">0</div>
                                <div class="text-gray-400 mt-1">Games Played</div>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-6 card-hover">
                                <div class="text-3xl font-bold text-green-400" id="wins">0</div>
                                <div class="text-gray-400 mt-1">Wins</div>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-6 card-hover">
                                <div class="text-3xl font-bold text-red-400" id="losses">0</div>
                                <div class="text-gray-400 mt-1">Losses</div>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Games -->
                    <div class="mb-8">
                        <h3 class="text-xl font-semibold mb-4 text-white">Recent Games</h3>
                        <div class="bg-slate-800 rounded-lg overflow-hidden">
                            <div class="grid grid-cols-4 gap-4 p-4 bg-slate-700 text-sm font-medium text-gray-300">
                                <div>GAME</div>
                                <div>OPPONENT</div>
                                <div>RESULT</div>
                                <div>DATE</div>
                            </div>
                            <div id="recentGamesContainer">
                                <div class="p-8 text-center empty-state">
                                    <div class="text-4xl mb-4">🎮</div>
                                    <p class="text-gray-400">No games played yet</p>
                                    <p class="text-sm text-gray-500 mt-2">Start playing to see your game history here</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Achievements -->
                    <div class="mb-8">
                        <h3 class="text-xl font-semibold mb-4 text-white">Recent Achievements</h3>
                        <div id="achievementsContainer" class="space-y-4">
                            <div class="text-center py-8 empty-state">
                                <div class="text-4xl mb-4">🏆</div>
                                <p class="text-gray-400">No achievements yet</p>
                                <p class="text-sm text-gray-500 mt-2">Play games to unlock achievements</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        this.bindElements();
        this.attachEventListeners();
        await this.loadUserData();
        this.populateUserInterface();
    }

    public cleanup(): void {
        if (this.playButton) {
            this.playButton.removeEventListener('click', this.handlePlayClick);
        }
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.removeEventListener('click', this.handleLogout);
        }

        const closeButton = document.getElementById('closeButton');
        if (closeButton) {
            closeButton.removeEventListener('click', this.hideModal);
        }

        if (this.modalOverlay) {
            this.modalOverlay.removeEventListener('click', this.handleModalClick);
        }

        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private bindElements(): void {
        this.playButton = document.getElementById('playButton');
        this.modalOverlay = document.getElementById('modalOverlay');
    }

    private attachEventListeners(): void {
        if (this.playButton) {
            this.playButton.addEventListener('click', this.handlePlayClick.bind(this));
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        // Modal events
        const closeButton = document.getElementById('closeButton');
        if (closeButton) {
            closeButton.addEventListener('click', this.hideModal.bind(this));
        }

        if (this.modalOverlay) {
            this.modalOverlay.addEventListener('click', this.handleModalClick.bind(this));
        }

        document.addEventListener('keydown', this.handleKeyDown.bind(this));

        // Game mode selection
        const gameModeButtons = document.querySelectorAll('[data-game-mode]');
        gameModeButtons.forEach(button => {
            button.addEventListener('click', this.handleGameModeSelect.bind(this));
        });
    }

    private async loadUserData(): Promise<void> {
        try {
            // Get user data from localStorage
            const userDataStr = localStorage.getItem('userData');
            const token = localStorage.getItem('token');
            
            if (userDataStr) {
                this.currentUser = JSON.parse(userDataStr);
            }

            if (token) {
                // Fetch latest profile data with photo
                await this.fetchLatestProfile(token);
                
                // Fetch game data
                this.gameData = await fetchUserGameData(token);
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
            showError('Failed to load dashboard data. Please try refreshing the page.');
        }
    }

    private async fetchLatestProfile(token: string): Promise<void> {
        try {
            // Fetch profile data
            const profileResponse = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (profileResponse.ok) {
                const profile = await profileResponse.json();
                // Update current user with profile username
                if (this.currentUser && profile.username) {
                    this.currentUser.name = profile.username;
                }
            }

            // Fetch photo data
            const photoResponse = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/photo`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (photoResponse.ok) {
                const photo = await photoResponse.json();
                // Store photo data for later use
                if (this.currentUser) {
                    this.currentUser.photo = photo;
                }
            }
        } catch (error) {
            console.log('Could not fetch profile/photo data:', error);
            // Not critical, continue with localStorage data
        }
    }

    private populateUserInterface(): void {
        if (!this.currentUser) return;

        // Update user avatar and info
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userHandle = document.getElementById('userHandle');
        const userRating = document.getElementById('userRating');
        
        if (userAvatar) {
            // Check if user has a photo
            if (this.currentUser.photo) {
                userAvatar.innerHTML = `<img src="${API_CONFIG.GATEWAY_URL}${this.currentUser.photo.path}" alt="User Avatar" class="w-16 h-16 rounded-full object-cover">`;
            } else {
                // Use initials as fallback
                const initials = this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
                userAvatar.innerHTML = `<span class="text-white font-bold text-xl">${initials}</span>`;
            }
        }
        
        if (userName) {
            userName.textContent = this.currentUser.name;
        }
        
        if (userHandle) {
            const handle = this.currentUser.email ? 
                `@${this.currentUser.email.split('@')[0]}` : 
                `@${this.currentUser.name.toLowerCase().replace(/\s+/g, '')}`;
            userHandle.textContent = handle;
        }
        
        if (userRating && this.gameData) {
            userRating.textContent = this.gameData.stats?.rating?.toString() || '1000';
        }
        
        // Update game statistics
        this.updateGameStatistics();
        
        // Populate sections
        this.populateRecentGames();
        this.populateAchievements();
    }

    private updateGameStatistics(): void {
        if (!this.gameData) return;

        const gamesPlayed = document.getElementById('gamesPlayed');
        const wins = document.getElementById('wins');
        const losses = document.getElementById('losses');
        
        if (gamesPlayed) gamesPlayed.textContent = this.gameData.stats?.gamesPlayed?.toString() || '0';
        if (wins) wins.textContent = this.gameData.stats?.wins?.toString() || '0';
        if (losses) losses.textContent = this.gameData.stats?.losses?.toString() || '0';
    }

    private populateRecentGames(): void {
        const container = document.getElementById('recentGamesContainer');
        if (!container) return;

        const recentGames = this.gameData?.recentGames || [];
        
        if (recentGames.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center empty-state">
                    <div class="text-4xl mb-4">🎮</div>
                    <p class="text-gray-400">No games played yet</p>
                    <p class="text-sm text-gray-500 mt-2">Start playing to see your game history here</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentGames.map((game: any) => `
            <div class="grid grid-cols-4 gap-4 p-4 border-b border-slate-700 hover:bg-slate-700 transition-colors">
                <div class="font-medium">${game.game}</div>
                <div class="text-gray-400">${game.opponent}</div>
                <div class="${game.result === 'win' ? 'text-green-400' : 'text-red-400'}">${game.result === 'win' ? 'Win' : 'Loss'} (${game.score})</div>
                <div class="text-gray-400 text-sm">${game.date}</div>
            </div>
        `).join('');
    }

    private populateAchievements(): void {
        const container = document.getElementById('achievementsContainer');
        if (!container) return;

        const achievements = this.gameData?.achievements || [];
        
        if (achievements.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 empty-state">
                    <div class="text-4xl mb-4">🏆</div>
                    <p class="text-gray-400">No achievements yet</p>
                    <p class="text-sm text-gray-500 mt-2">Play games to unlock achievements</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = achievements.slice(0, 4).map((achievement: any) => `
            <div class="bg-slate-700 p-4 rounded-lg flex items-center space-x-4 card-hover">
                <div class="text-2xl">${achievement.icon}</div>
                <div>
                    <h4 class="font-semibold">${achievement.name}</h4>
                    <p class="text-gray-400 text-sm">${achievement.description}</p>
                    <p class="text-gray-500 text-xs">${achievement.unlockedAt}</p>
                </div>
            </div>
        `).join('');
    }

    private handlePlayClick(e: Event): void {
        e.preventDefault();
        this.showModal();
    }

    private showModal(): void {
        if (this.modalOverlay) {
            this.modalOverlay.classList.remove('hidden');
            this.modalOverlay.classList.add('flex');
            document.body.style.overflow = 'hidden';
        }
    }

    private hideModal(): void {
        if (this.modalOverlay) {
            this.modalOverlay.classList.add('hidden');
            this.modalOverlay.classList.remove('flex');
            document.body.style.overflow = 'auto';
        }
    }

    private handleModalClick(e: Event): void {
        if (e.target === this.modalOverlay) {
            this.hideModal();
        }
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && this.modalOverlay && !this.modalOverlay.classList.contains('hidden')) {
            this.hideModal();
        }
    }

    private handleGameModeSelect(e: Event): void {
        const target = e.currentTarget as HTMLElement;
        const gameMode = target.getAttribute('data-game-mode');
        
        this.hideModal();
        
        switch (gameMode) {
            case 'solo-ai':
            case 'multiplayer-local':
                this.navigateToGame();
                break;
            case 'settings':
                this.navigateToSettings();
                break;
        }
    }

    private navigateToGame(): void {
        // Dispatch navigation event
        const event = new CustomEvent('navigate', {
            detail: { path: '/game' }
        });
        window.dispatchEvent(event);
    }

    private navigateToSettings(): void {
        // Dispatch navigation event
        const event = new CustomEvent('navigate', {
            detail: { path: '/dashboard/settings' }
        });
        window.dispatchEvent(event);
    }

    private handleLogout(e: Event): void {
        e.preventDefault();
        
        // Clear authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        
        // Dispatch logout event
        const event = new CustomEvent('logout');
        window.dispatchEvent(event);
        
        showNotification('Successfully logged out', 'success');
    }
}