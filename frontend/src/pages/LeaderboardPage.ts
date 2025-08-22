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
            <div class="fixed inset-0 flex h-screen bg-slate-900">
                ${this.renderSidebar()}
                <div class="flex-1 p-8 overflow-y-auto">
                    <div class="fade-in">
                        <h2 class="text-3xl font-bold mb-6 text-white">Leaderboard</h2>
                        <div class="bg-slate-800 rounded-lg p-6">
                            <div class="flex items-center justify-between mb-4">
                                <p class="text-gray-300">Top players and rankings</p>
                                <button id="refreshBtn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
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
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span class="ml-3 text-gray-300">Loading leaderboard...</span>
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
            <div class="flex items-center justify-between p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
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
                    <div class="text-lg font-bold text-blue-400">${player.ranking_points} pts</div>
                    ${player.win_streak > 0 ? `<div class="text-sm text-green-400">🔥 ${player.win_streak} streak</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    private getRankColor(rank: number): string {
        if (rank === 1) return 'text-yellow-500';
        if (rank === 2) return 'text-gray-300';
        if (rank === 3) return 'text-amber-600';
        return 'text-blue-400';
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
                    <button onclick="window.leaderboardPage?.initialize()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    public async initialize(): Promise<void> {
        console.log('Leaderboard page initialized');
        (window as any).leaderboardPage = this;
        
        // Initial load
        await this.fetchLeaderboard();
        
        // Set up refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.fetchLeaderboard());
        }
    }

    public cleanup(): void {
        console.log('Leaderboard page cleaned up');
    }

    private renderSidebar(): string {
        return this.getSidebar('/dashboard/leaderboard');
    }

    private getSidebar(activeRoute: string): string {
        const navItems = [
            { route: '/dashboard', icon: '🎮', label: 'Dashboard' },
            { route: '/dashboard/profile', icon: '👤', label: 'Profile' },
            { route: '/dashboard/leaderboard', icon: '🏆', label: 'Leaderboard', active: true },
            { route: '/dashboard/settings', icon: '⚙️', label: 'Settings' },
            { route: '/chat', icon: '💬', label: 'Chat' }
        ];

        return `
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
                    ${navItems.map(item => {
                        const isActive = item.route === activeRoute;
                        const activeClasses = isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700';
                        return `
                            <a href="#" data-route="${item.route}" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg ${activeClasses} transition-colors">
                                <span>${item.icon}</span>
                                <span>${item.label}</span>
                            </a>
                        `;
                    }).join('')}
                    
                    <a href="#" id="logoutBtn" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors">
                        <span>🚪</span>
                        <span>Logout</span>
                    </a>
                </nav>
            </div>
        `;
    }
}