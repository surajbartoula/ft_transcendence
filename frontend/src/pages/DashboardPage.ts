import { Page } from '../router/Router';
import { User } from '../utils/auth';
import { fetchUserGameData } from '../utils/dashboard';
import { generateAvatarUrl, showNotification } from '../utils/ui';
import { API_CONFIG } from '../config';

export class DashboardPage implements Page {
    public title = 'Dashboard';
    public requiresAuth = true;
    
    private currentUser: User | null = null;
    private gameData: any = null;
    private playButton: HTMLElement | null = null;

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
                        <a href="#" id="playButton" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                            <span>🎮</span>
                            <span>Play Pong</span>
                        </a>
                        <a href="#" data-route="/dashboard/profile" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
                            <span>👤</span>
                            <span>Profile</span>
                        </a>
                        <a href="#" data-route="/dashboard/leaderboard" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
                            <span>🏆</span>
                            <span>Leaderboard</span>
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
                    <div class="flex items-center justify-between mb-8 animate-slide-down">
                        <div class="flex items-center space-x-4">
                            <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xl font-bold animate-bounce-in hover:scale-110 transition-transform duration-300" id="userAvatar">
                                <div class="loading-spinner"></div>
                            </div>
                            <div class="animate-fade-in-left">
                                <h2 class="text-2xl text-white font-bold" id="userName">Loading...</h2>
                                <p class="text-gray-400" id="userHandle">@loading</p>
                                <div class="flex items-center space-x-2 mt-1">
                                    <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span class="text-sm text-green-400">Online</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-right animate-fade-in-right">
                            <div class="text-3xl font-bold text-yellow-500 hover:scale-105 transition-transform duration-200" id="userRating">0</div>
                            <div class="text-sm text-gray-400">Rating</div>
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div class="mb-8 animate-fade-in-up" style="animation-delay: 0.2s">
                        <h3 class="text-xl font-semibold text-white mb-4">Quick Actions</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button id="quickPlayButton" class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-6 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/25 flex items-center justify-center space-x-3 animate-slide-up" style="animation-delay: 0.3s">
                                <span class="text-2xl animate-bounce-slow">🏓</span>
                                <div class="text-left">
                                    <div class="font-bold text-lg">Play Pong</div>
                                    <div class="text-sm text-blue-100">Start playing now</div>
                                </div>
                            </button>
                            <button data-route="/dashboard/profile" class="bg-slate-700 hover:bg-slate-600 text-white p-6 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:shadow-slate-500/25 flex items-center justify-center space-x-3 animate-slide-up" style="animation-delay: 0.4s">
                                <span class="text-2xl hover:animate-pulse">👤</span>
                                <div class="text-left">
                                    <div class="font-bold text-lg">View Profile</div>
                                    <div class="text-sm text-gray-300">Edit your profile</div>
                                </div>
                            </button>
                            <button data-route="/dashboard/leaderboard" class="bg-slate-700 hover:bg-slate-600 text-white p-6 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:shadow-slate-500/25 flex items-center justify-center space-x-3 animate-slide-up" style="animation-delay: 0.5s">
                                <span class="text-2xl hover:animate-bounce">🏆</span>
                                <div class="text-left">
                                    <div class="font-bold text-lg">Leaderboard</div>
                                    <div class="text-sm text-gray-300">See top players</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <!-- Game Statistics -->
                    <div class="mb-8 animate-fade-in-up" style="animation-delay: 0.6s">
                        <h3 class="text-xl font-semibold text-white mb-4">Game Statistics</h3>
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div class="bg-slate-700 rounded-lg p-6 transform transition-all duration-300 hover:scale-105 hover:bg-slate-600 hover:shadow-xl animate-stat-card cursor-pointer" style="animation-delay: 0.7s">
                                <div class="text-3xl font-bold text-blue-400 counter-animation" id="gamesPlayed" data-target="0">0</div>
                                <div class="text-gray-400 mt-1">Games Played</div>
                                <div class="absolute top-2 right-2 text-blue-400 opacity-30">🎮</div>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-6 transform transition-all duration-300 hover:scale-105 hover:bg-slate-600 hover:shadow-xl animate-stat-card cursor-pointer" style="animation-delay: 0.8s">
                                <div class="text-3xl font-bold text-green-400 counter-animation" id="wins" data-target="0">0</div>
                                <div class="text-gray-400 mt-1">Wins</div>
                                <div class="absolute top-2 right-2 text-green-400 opacity-30">🏆</div>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-6 transform transition-all duration-300 hover:scale-105 hover:bg-slate-600 hover:shadow-xl animate-stat-card cursor-pointer" style="animation-delay: 0.9s">
                                <div class="text-3xl font-bold text-red-400 counter-animation" id="losses" data-target="0">0</div>
                                <div class="text-gray-400 mt-1">Losses</div>
                                <div class="absolute top-2 right-2 text-red-400 opacity-30">💔</div>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-6 transform transition-all duration-300 hover:scale-105 hover:bg-slate-600 hover:shadow-xl animate-stat-card cursor-pointer" style="animation-delay: 1.0s">
                                <div class="text-3xl font-bold text-yellow-400 counter-animation" id="winRate" data-target="0">0%</div>
                                <div class="text-gray-400 mt-1">Win Rate</div>
                                <div class="absolute top-2 right-2 text-yellow-400 opacity-30">📊</div>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Games -->
                    <div class="mb-8 animate-fade-in-up" style="animation-delay: 1.1s">
                        <h3 class="text-xl font-semibold mb-4 text-white">Recent Games</h3>
                        <div class="bg-slate-800 rounded-lg overflow-hidden transform transition-all duration-300 hover:shadow-xl">
                            <div class="grid grid-cols-4 gap-4 p-4 bg-slate-700 text-sm font-medium text-gray-300">
                                <div class="animate-fade-in" style="animation-delay: 1.2s">GAME</div>
                                <div class="animate-fade-in" style="animation-delay: 1.3s">OPPONENT</div>
                                <div class="animate-fade-in" style="animation-delay: 1.4s">RESULT</div>
                                <div class="animate-fade-in" style="animation-delay: 1.5s">DATE</div>
                            </div>
                            <div id="recentGamesContainer">
                                <div class="p-8 text-center empty-state animate-fade-in" style="animation-delay: 1.6s">
                                    <div class="text-4xl mb-4 animate-bounce-slow">🎮</div>
                                    <p class="text-gray-400">No games played yet</p>
                                    <p class="text-sm text-gray-500 mt-2">Start playing to see your game history here</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Achievements -->
                    <div class="mb-8 animate-fade-in-up" style="animation-delay: 1.7s">
                        <h3 class="text-xl font-semibold mb-4 text-white">Recent Achievements</h3>
                        <div id="achievementsContainer" class="space-y-4">
                            <div class="text-center py-8 empty-state animate-fade-in" style="animation-delay: 1.8s">
                                <div class="text-4xl mb-4 animate-bounce-slow">🏆</div>
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
        
        const quickPlayButton = document.getElementById('quickPlayButton');
        if (quickPlayButton) {
            quickPlayButton.removeEventListener('click', this.handlePlayClick);
        }
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.removeEventListener('click', this.handleLogout);
        }

        // Remove quick action event listeners
        const quickActionButtons = document.querySelectorAll('[data-route]');
        quickActionButtons.forEach(button => {
            button.removeEventListener('click', this.handleQuickAction);
        });
    }

    private bindElements(): void {
        this.playButton = document.getElementById('playButton');
    }

    private attachEventListeners(): void {
        // Main sidebar play button
        if (this.playButton) {
            this.playButton.addEventListener('click', this.handlePlayClick.bind(this));
        }

        // Quick play button in main content
        const quickPlayButton = document.getElementById('quickPlayButton');
        if (quickPlayButton) {
            quickPlayButton.addEventListener('click', this.handlePlayClick.bind(this));
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        // Quick action buttons
        const quickActionButtons = document.querySelectorAll('[data-route]');
        quickActionButtons.forEach(button => {
            button.addEventListener('click', this.handleQuickAction.bind(this));
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
                // Fetch latest profile data with photo (don't let this fail the whole process)
                try {
                    await this.fetchLatestProfile(token);
                } catch (profileError) {
                    console.warn('Could not fetch profile data:', profileError);
                }
                
                // Fetch game data (don't let this fail the whole process)
                try {
                    this.gameData = await fetchUserGameData(token);
                } catch (gameDataError) {
                    console.warn('Could not fetch game data:', gameDataError);
                    // Use default game data
                    this.gameData = {
                        stats: { rating: 1000, gamesPlayed: 0, wins: 0, losses: 0, winRate: 0 },
                        recentGames: [],
                        achievements: []
                    };
                }
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
            // Don't show error popup - just continue with what we have
            console.warn('Continuing with default/cached data');
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
            // Fetch photo data - handle gracefully if user has no photo
            try {
                const photoResponse = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/photo`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (photoResponse.ok) {
                    const photo = await photoResponse.json();
                    // Store photo data for later use
                    if (this.currentUser && photo && photo.path) {
                        this.currentUser.photo = photo;
                    }
                } else if (photoResponse.status === 404) {
                    console.log('User has no photo, will use default avatar');
                    // Explicitly handle 404 - user simply has no photo
                } else {
                    console.warn('Photo request failed with status:', photoResponse.status);
                }
                // If photo request fails or returns no photo, we'll use the fallback avatar in populateUserInterface
            } catch (photoError) {
                console.log('No user photo available, will use default avatar:', photoError);
                // Don't set photo property, so fallback avatar will be used
            }
        } catch (error) {
            console.log('Could not fetch profile/photo data:', error);
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
            if (this.currentUser.photo && this.currentUser.photo.path) {
                userAvatar.innerHTML = `<img src="${API_CONFIG.GATEWAY_URL}${this.currentUser.photo.path}" alt="User Avatar" class="w-16 h-16 rounded-full object-cover">`;
            } else {
                userAvatar.innerHTML = `<img src="${generateAvatarUrl()}" alt="" class="w-16 h-16 rounded-full object-cover">`;
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
        
        const totalGames = this.gameData.stats?.gamesPlayed || 0;
        const totalWins = this.gameData.stats?.wins || 0;
        const totalLosses = this.gameData.stats?.losses || 0;
        const winPercentage = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
        
        // Animate counters with delay
        setTimeout(() => {
            this.animateCounter('gamesPlayed', totalGames);
        }, 800);
        
        setTimeout(() => {
            this.animateCounter('wins', totalWins);
        }, 1000);
        
        setTimeout(() => {
            this.animateCounter('losses', totalLosses);
        }, 1200);
        
        setTimeout(() => {
            this.animateCounterPercentage('winRate', winPercentage);
        }, 1400);
    }

    private animateCounter(elementId: string, targetValue: number): void {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const duration = 1000; // 1 second
        const steps = 50;
        const stepDuration = duration / steps;
        const increment = targetValue / steps;
        
        let currentValue = 0;
        const timer = setInterval(() => {
            currentValue += increment;
            if (currentValue >= targetValue) {
                currentValue = targetValue;
                clearInterval(timer);
                
                // Add a bounce effect when reaching target
                element.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                }, 200);
            }
            element.textContent = Math.floor(currentValue).toString();
        }, stepDuration);
    }

    private animateCounterPercentage(elementId: string, targetValue: number): void {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const duration = 1000;
        const steps = 50;
        const stepDuration = duration / steps;
        const increment = targetValue / steps;
        
        let currentValue = 0;
        const timer = setInterval(() => {
            currentValue += increment;
            if (currentValue >= targetValue) {
                currentValue = targetValue;
                clearInterval(timer);
                
                // Add a bounce effect when reaching target
                element.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                }, 200);
            }
            element.textContent = `${Math.floor(currentValue)}%`;
        }, stepDuration);
    }

    private populateRecentGames(): void {
        const container = document.getElementById('recentGamesContainer');
        if (!container) return;
        
        const recentGames = this.gameData?.recentGames || [];
        if (recentGames.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center empty-state animate-fade-in" style="animation-delay: 1.6s">
                    <div class="text-4xl mb-4 animate-bounce-slow">🎮</div>
                    <p class="text-gray-400">No games played yet</p>
                    <p class="text-sm text-gray-500 mt-2">Start playing to see your game history here</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentGames.map((game: any, index: number) => `
            <div class="grid grid-cols-4 gap-4 p-4 border-b border-slate-700 hover:bg-slate-700 transition-all duration-300 transform hover:scale-[1.02] animate-slide-up" style="animation-delay: ${1.7 + index * 0.1}s">
                <div class="font-medium flex items-center">
                    <span class="mr-2">🎮</span>
                    ${game.game}
                </div>
                <div class="text-gray-400 flex items-center">
                    <span class="mr-2">👤</span>
                    ${game.opponent}
                </div>
                <div class="flex items-center ${game.result === 'win' ? 'text-green-400' : 'text-red-400'}">
                    <span class="mr-2">${game.result === 'win' ? '🏆' : '💔'}</span>
                    <div class="flex flex-col">
                        <div class="font-medium">${game.result === 'win' ? 'WIN' : 'LOSS'}</div>
                        <div class="text-xs text-gray-400">You ${game.score}</div>
                    </div>
                </div>
                <div class="text-gray-400 text-sm flex items-center">
                    <span class="mr-2">📅</span>
                    ${game.date}
                </div>
            </div>
        `).join('');
    }

    private populateAchievements(): void {
        const container = document.getElementById('achievementsContainer');
        if (!container) return;
        
        const achievements = this.gameData?.achievements || [];
        if (achievements.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 empty-state animate-fade-in" style="animation-delay: 1.8s">
                    <div class="text-4xl mb-4 animate-bounce-slow">🏆</div>
                    <p class="text-gray-400">No achievements yet</p>
                    <p class="text-sm text-gray-500 mt-2">Play games to unlock achievements</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = achievements.slice(0, 4).map((achievement: any, index: number) => `
            <div class="bg-slate-700 p-4 rounded-lg flex items-center space-x-4 transform transition-all duration-300 hover:scale-105 hover:bg-slate-600 hover:shadow-xl cursor-pointer animate-slide-up achievement-card" style="animation-delay: ${2.0 + index * 0.15}s" onclick="this.classList.add('animate-glow')">
                <div class="text-2xl achievement-icon animate-bounce-slow" style="animation-delay: ${2.2 + index * 0.15}s">${achievement.icon}</div>
                <div class="flex-1">
                    <h4 class="font-semibold text-white">${achievement.name}</h4>
                    <p class="text-gray-400 text-sm">${achievement.description}</p>
                    <p class="text-gray-500 text-xs mt-1">Unlocked recently</p>
                </div>
                <div class="text-xs text-green-400 font-bold">NEW!</div>
            </div>
        `).join('');
        
        // Add click animation to achievement cards
        setTimeout(() => {
            const achievementCards = document.querySelectorAll('.achievement-card');
            achievementCards.forEach((card) => {
                card.addEventListener('click', () => {
                    card.classList.add('animate-glow');
                    setTimeout(() => {
                        card.classList.remove('animate-glow');
                    }, 2000);
                });
            });
        }, 2500);
    }

    private handlePlayClick(e: Event): void {
        e.preventDefault();
        this.navigateToGame();
    }

    private handleQuickAction(e: Event): void {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        const route = target.getAttribute('data-route');
        
        if (route) {
            const event = new CustomEvent('navigate', {
                detail: { path: route }
            });
            window.dispatchEvent(event);
        }
    }

    private navigateToGame(): void {
        // Show notification for better UX
        // showNotification('Loading Pong game...', 'info', 2000);
        
        // Dispatch navigation event to game page
        const event = new CustomEvent('navigate', {
            detail: { path: '/game' }
        });
        window.dispatchEvent(event);
    }

    private handleLogout(e: Event): void {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        
        // Dispatch logout event
        const event = new CustomEvent('logout');
        window.dispatchEvent(event);
        showNotification('Successfully logged out', 'success');
    }
}