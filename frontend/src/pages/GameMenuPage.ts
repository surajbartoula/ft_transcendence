import { Page } from '../router/Router';
import { showNotification } from '../utils/ui';

export class GameMenuPage implements Page {
    public title = 'Game Menu';
    public requiresAuth = true;

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
                                <span>Back to Dashboard</span>
                            </button>
                            <div class="h-6 w-px bg-cyan-500/30"></div>
                            <h1 class="text-2xl font-bold text-cyan-400">Game Menu</h1>
                        </div>
                        <div class="text-sm text-cyan-300">
                            Choose your game mode
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 p-8 relative z-10 bg-slate-900/50 backdrop-blur-sm">
                    <div class="max-w-4xl w-full mx-auto">
                        <!-- Game Mode Cards -->
                        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <!-- Local 2-Player Game -->
                            <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 hover:border-cyan-400 transition-all duration-300 cursor-pointer game-mode-card tron-border hover:tron-glow" data-mode="local">
                                <div class="p-6">
                                    <div class="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center mb-4 mx-auto tron-glow">
                                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                        </svg>
                                    </div>
                                    <h3 class="text-lg font-semibold text-cyan-300 text-center mb-2">2-Player Local</h3>
                                    <p class="text-sm text-gray-400 text-center mb-4">Play against a friend on the same device</p>
                                    <div class="text-xs text-cyan-500 text-center">
                                        Controls: Arrow Keys & W/S
                                    </div>
                                </div>
                            </div>

                            <!-- AI Game -->
                            <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 hover:border-green-400 transition-all duration-300 cursor-pointer game-mode-card tron-border hover:tron-glow" data-mode="ai">
                                <div class="p-6">
                                    <div class="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mb-4 mx-auto tron-glow">
                                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                        </svg>
                                    </div>
                                    <h3 class="text-lg font-semibold text-cyan-300 text-center mb-2">vs AI</h3>
                                    <p class="text-sm text-gray-400 text-center mb-4">Challenge our intelligent AI opponent</p>
                                    <div class="text-xs text-green-400 text-center">
                                        Challenge the AI and test your skills!
                                    </div>
                                </div>
                            </div>

                            <!-- Tournament -->
                            <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 hover:border-purple-400 transition-all duration-300 cursor-pointer game-mode-card tron-border hover:tron-glow" data-mode="tournament">
                                <div class="p-6">
                                    <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mb-4 mx-auto tron-glow">
                                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                        </svg>
                                    </div>
                                    <h3 class="text-lg font-semibold text-cyan-300 text-center mb-2">Tournament</h3>
                                    <p class="text-sm text-gray-400 text-center mb-4">Create or join tournaments with multiple players</p>
                                    <div class="text-xs text-purple-400 text-center">
                                        2-16 players
                                    </div>
                                </div>
                            </div>

                            <!-- Remote Multiplayer -->
                            <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 hover:border-orange-400 transition-all duration-300 cursor-pointer game-mode-card tron-border hover:tron-glow" data-mode="remote">
                                <div class="p-6">
                                    <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center mb-4 mx-auto tron-glow">
                                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
                                        </svg>
                                    </div>
                                    <h3 class="text-lg font-semibold text-cyan-300 text-center mb-2">Online Match</h3>
                                    <p class="text-sm text-gray-400 text-center mb-4">Play against other players online</p>
                                    <div class="text-xs text-orange-400 text-center">
                                        Real-time multiplayer
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Game Statistics -->
                        <div class="mt-12 bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                            <h2 class="text-xl font-semibold text-cyan-300 mb-4 text-center">Game Statistics</h2>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-cyan-400" data-stat="total_games">-</div>
                                    <div class="text-sm text-gray-400">Games Played</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-green-400" data-stat="wins">-</div>
                                    <div class="text-sm text-gray-400">Wins</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-red-400" data-stat="losses">-</div>
                                    <div class="text-sm text-gray-400">Losses</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-yellow-400" data-stat="ranking_points">-</div>
                                    <div class="text-sm text-gray-400">Rating</div>
                                </div>
                            </div>
                        </div>

                        <!-- Recent Games -->
                        <div class="mt-8 bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                            <h2 class="text-xl font-semibold text-cyan-300 mb-4">Recent Games</h2>
                            <div id="recentGamesContainer">
                                <div class="text-center text-cyan-400 py-8">
                                    Loading recent games...
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        this.attachEventListeners();
        await Promise.all([
            this.loadUserStats(),
            this.loadRecentGames()
        ]);
    }

    public cleanup(): void {
        this.removeEventListeners();
    }

    private attachEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', this.handleBackClick.bind(this));
        }

        // Game mode card clicks
        const gameModeCards = document.querySelectorAll('.game-mode-card');
        gameModeCards.forEach(card => {
            card.addEventListener('click', this.handleGameModeClick.bind(this));
        });
    }

    private removeEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.removeEventListener('click', this.handleBackClick);
        }

        const gameModeCards = document.querySelectorAll('.game-mode-card');
        gameModeCards.forEach(card => {
            card.removeEventListener('click', this.handleGameModeClick);
        });
    }

    private handleBackClick(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: '/dashboard' }
        });
        window.dispatchEvent(event);
    }

    private handleGameModeClick(event: Event): void {
        const card = event.currentTarget as HTMLElement;
        const mode = card.getAttribute('data-mode');

        switch (mode) {
            case 'local':
                this.navigateToGame('local');
                break;
            case 'ai':
                this.navigateToGame('ai');
                break;
            case 'tournament':
                this.navigateToTournamentSetup();
                break;
            case 'remote':
                this.navigateToRemoteMatch();
                break;
            default:
                showNotification('Game mode not available yet', 'info');
        }
    }

    private navigateToGame(mode: 'local' | 'ai'): void {
        const event = new CustomEvent('navigate', {
            detail: { path: `/game/play?mode=${mode}` }
        });
        window.dispatchEvent(event);
    }

    private navigateToTournamentSetup(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: '/game/tournament/setup' }
        });
        window.dispatchEvent(event);
    }

    private navigateToRemoteMatch(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: '/game/online' }
        });
        window.dispatchEvent(event);
    }

    private async loadUserStats(): Promise<void> {
        try {
            const response = await fetch('/api/game/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            // Stats API response received

            if (response.ok) {
                const text = await response.text();
                if (text.trim()) {
                    const data = JSON.parse(text);
                    if (data && data.stats) {
                        this.updateStatsDisplay(data.stats);
                    } else {
                        // No stats data found in response
                    }
                } else {
                    // Empty response from stats API
                }
            } else {
                // Stats API request failed
            }
        } catch (error) {
            // Failed to load user stats
            // Continue without stats - they'll show as "-"
        }
    }

    private updateStatsDisplay(stats: any): void {
        const statElements = document.querySelectorAll('[data-stat]');
        statElements.forEach((element, index) => {
            const statType = element.getAttribute('data-stat');
            // Processing stat element
            
            if (statType && stats[statType] !== undefined) {
                const value = stats[statType].toString();
                element.textContent = value;
                // Stat updated
            } else {
                // No value found for stat
            }
        });
    }

    private async loadRecentGames(): Promise<void> {
        try {
            const response = await fetch('/api/game/history?limit=10', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                const text = await response.text();
                if (text.trim()) {
                    const data = JSON.parse(text);
                    if (data && data.games) {
                        this.updateRecentGamesDisplay(data.games);
                    } else {
                        // No games data found in response
                        this.showNoRecentGames();
                    }
                } else {
                    // Empty response from recent games API
                    this.showNoRecentGames();
                }
            } else {
                // Recent games API request failed
                this.showNoRecentGames();
            }
        } catch (error) {
            // Failed to load recent games
            this.showNoRecentGames();
        }
    }

    private updateRecentGamesDisplay(games: any[]): void {
        // Updating recent games display
        
        const container = document.getElementById('recentGamesContainer');
        if (!container) {
            // Recent games container not found
            return;
        }

        if (games.length === 0) {
            this.showNoRecentGames();
            return;
        }

        container.innerHTML = games.map(game => {
            const date = new Date(game.finished_at).toLocaleDateString();
            const time = new Date(game.finished_at).toLocaleTimeString();
            const resultClass = game.result === 'won' ? 'text-green-400' : game.result === 'lost' ? 'text-red-400' : 'text-yellow-400';
            const resultText = game.result === 'won' ? 'Victory' : game.result === 'lost' ? 'Defeat' : 'Draw';
            
            return `
                <div class="bg-slate-700/70 backdrop-blur-sm rounded-lg p-4 mb-3 last:mb-0 tron-border hover:tron-glow transition-all duration-300">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center space-x-2 mb-2">
                                <span class="text-cyan-300 font-medium">${game.game_mode || 'Game'}</span>
                                <span class="px-2 py-1 text-xs rounded ${resultClass} bg-opacity-20 border border-current">
                                    ${resultText}
                                </span>
                            </div>
                            <div class="text-sm text-gray-400">
                                Score: ${game.player1_score || 0} - ${game.player2_score || 0}
                            </div>
                            ${game.duration ? `<div class="text-xs text-gray-500">Duration: ${Math.round(game.duration / 60)}m ${game.duration % 60}s</div>` : ''}
                        </div>
                        <div class="text-right text-xs text-gray-500">
                            <div>${date}</div>
                            <div>${time}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Recent games display updated
    }

    private showNoRecentGames(): void {
        const container = document.getElementById('recentGamesContainer');
        if (container) {
            container.innerHTML = `
                <div class="text-center text-cyan-400 py-8">
                    No recent games found. Start playing to see your match history!
                </div>
            `;
        }
    }
}