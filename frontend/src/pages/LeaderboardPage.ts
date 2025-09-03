import { Page } from '../router/Router';
import { API_CONFIG } from '../config';
import { getStoredToken } from '../utils/auth';
import { generateAvatarUrl } from '../utils/ui';

interface LeaderboardPlayer {
    rank: number;
    user_id: string;
    username: string;
    photo: {
        filename: string;
        path: string;
        uploaded_at: string | null;
        is_default: boolean;
    } | null;
    ranking_points: number;
    total_games: number;
    wins: number;
    losses: number;
    win_rate: number;
    win_streak: number;
    tournaments_won: number;
}

export class LeaderboardPage implements Page {
    public title = 'Leaderboard';
    public requiresAuth = true;
    private leaderboardData: LeaderboardPlayer[] = [];
    private isLoading = true;

    public render(): string {
        return `
            <div class="fixed inset-0 flex h-screen bg-black relative overflow-hidden">
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
                ${this.renderSidebar()}
                <div class="flex-1 p-8 overflow-y-auto relative z-10 bg-slate-900/50 backdrop-blur-sm">
                    <div class="fade-in">
                        <h2 class="text-3xl font-bold mb-6 text-cyan-400">Leaderboard</h2>
                        <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg p-6 tron-border tron-glow">
                            <div class="flex items-center justify-between mb-4">
                                <p class="text-cyan-300">Top players and rankings</p>
                                <button id="refreshBtn" class="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white rounded font-medium transition-all duration-300 tron-glow">
                                    <span class="refresh-icon">${this.isLoading ? '⟳' : '↻'}</span>
                                    Refresh
                                </button>
                            </div>
                            <div id="leaderboardContent" class="space-y-3">
                                ${this.renderLeaderboardContent()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    private renderLeaderboardContent(): string {
        if (this.isLoading) {
            return `
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                    <span class="ml-3 text-cyan-300">Loading leaderboard...</span>
                </div>
            `;
        }

        if (this.leaderboardData.length === 0) {
            return `
                <div class="text-center py-8">
                    <p class="text-gray-400">No players found. Start playing to appear on the leaderboard!</p>
                </div>
            `;
        }

        return this.leaderboardData.map(player => `
            <div class="flex items-center justify-between p-4 bg-slate-700/70 backdrop-blur-sm rounded-lg hover:bg-slate-600/70 transition-all duration-300 tron-border hover:tron-glow">
                <div class="flex items-center space-x-4">
                    <span class="text-xl font-bold ${this.getRankColor(player.rank)}">#${player.rank}</span>
                    ${player.photo && !player.photo.is_default ? 
                        `<img src="${API_CONFIG.GATEWAY_URL}${player.photo.path}" alt="${player.username}" class="w-10 h-10 rounded-full object-cover">` :
                        `<img src="${generateAvatarUrl()}" alt="${player.username}" class="w-10 h-10 rounded-full object-cover">`
                    }
                    <div>
                        <div class="text-white font-semibold">${player.username}</div>
                        <div class="text-sm text-gray-400">
                            ${player.total_games} games • ${player.wins}W-${player.losses}L • ${player.win_rate}% win rate
                            ${player.tournaments_won > 0 ? ` • 🏆 ${player.tournaments_won}` : ''}
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-lg font-bold text-cyan-400">${player.ranking_points} pts</div>
                    ${player.win_streak > 0 ? `<div class="text-sm text-green-400">🔥 ${player.win_streak} streak</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    private getRankColor(rank: number): string {
        if (rank === 1) return 'text-yellow-400';
        if (rank === 2) return 'text-gray-300';
        if (rank === 3) return 'text-amber-500';
        return 'text-cyan-400';
    }

    private async fetchLeaderboard(): Promise<void> {
        try {
            this.isLoading = true;
            this.updateContent();

            const token = getStoredToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch(`${API_CONFIG.ENDPOINTS.GAME}/leaderboard?limit=50`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                this.leaderboardData = data.leaderboard;
            } else {
                throw new Error(data.error || 'Failed to fetch leaderboard');
            }
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            this.leaderboardData = [];
            this.showError(error instanceof Error ? error.message : 'Failed to load leaderboard');
        } finally {
            this.isLoading = false;
            this.updateContent();
        }
    }

    private updateContent(): void {
        const content = document.getElementById('leaderboardContent');
        if (content) {
            content.innerHTML = this.renderLeaderboardContent();
        }

        const refreshIcon = document.querySelector('.refresh-icon');
        if (refreshIcon) {
            refreshIcon.textContent = this.isLoading ? '⟳' : '↻';
            if (this.isLoading) {
                refreshIcon.classList.add('animate-spin');
            } else {
                refreshIcon.classList.remove('animate-spin');
            }
        }
    }

    private showError(message: string): void {
        const content = document.getElementById('leaderboardContent');
        if (content) {
            content.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-red-400 mb-2">⚠️ Error</div>
                    <p class="text-gray-400">${message}</p>
                    <button onclick="window.leaderboardPage?.initialize()" class="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white rounded font-medium transition-all duration-300 tron-glow">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    public async initialize(): Promise<void> {
        (window as any).leaderboardPage = this;
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initial load
        await this.fetchLeaderboard();
    }

    private setupEventListeners(): void {
        // Set up refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.fetchLeaderboard());
        }

        // Set up logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Dispatch logout event to be handled by main.ts
                window.dispatchEvent(new CustomEvent('logout'));
            });
        }

        // Set up sidebar navigation
        const sidebarItems = document.querySelectorAll('.sidebar-item:not(#logoutBtn)');
        sidebarItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const route = item.getAttribute('data-route');
                if (route) {
                    window.location.hash = route;
                }
            });
        });
    }

    public cleanup(): void {
        // Remove event listeners
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.removeEventListener('click', () => this.fetchLeaderboard());
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.removeEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('logout'));
            });
        }

        // Remove sidebar navigation listeners
        const sidebarItems = document.querySelectorAll('.sidebar-item:not(#logoutBtn)');
        sidebarItems.forEach(item => {
            item.removeEventListener('click', (e) => {
                e.preventDefault();
                const route = item.getAttribute('data-route');
                if (route) {
                    window.location.hash = route;
                }
            });
        });

        // Remove global reference
        if ((window as any).leaderboardPage === this) {
            delete (window as any).leaderboardPage;
        }
    }

    private renderSidebar(): string {
        return this.getSidebar();
    }

    private getSidebar(): string {
        return `
            <div class="w-64 bg-slate-900/90 backdrop-blur-sm border-r border-cyan-500/30 flex flex-col h-full relative z-10 tron-glow">
                <div class="p-6 border-b border-cyan-500/30">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center tron-glow">
                            <span class="text-white font-bold text-lg">G</span>
                        </div>
                        <h1 class="text-xl font-bold text-cyan-400">GameHub</h1>
                    </div>
                </div>
                
                <nav class="p-4 space-y-2 flex-1">
                    <a href="#" data-route="/dashboard" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all duration-300 hover:tron-border">
                        <span>🎮</span>
                        <span>Dashboard</span>
                    </a>
                    <a href="#" data-route="/dashboard/profile" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all duration-300 hover:tron-border">
                        <span>👤</span>
                        <span>Profile</span>
                    </a>
                    <a href="#" data-route="/dashboard/leaderboard" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 transition-all duration-300 tron-border tron-glow">
                        <span>🏆</span>
                        <span>Leaderboard</span>
                    </a>
                    <a href="#" data-route="/dashboard/settings" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all duration-300 hover:tron-border">
                        <span>⚙️</span>
                        <span>Settings</span>
                    </a>
                    <a href="#" data-route="/chat" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all duration-300 hover:tron-border">
                        <span>💬</span>
                        <span>Chat</span>
                    </a>
                    <a href="#" id="logoutBtn" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all duration-300">
                        <span>🚪</span>
                        <span>Logout</span>
                    </a>
                </nav>
            </div>
        `;
    }
}