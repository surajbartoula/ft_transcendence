import { Page } from '../router/Router';
import { showNotification } from '../utils/ui';

export class GameMenuPage implements Page {
    public title = 'Game Menu';
    public requiresAuth = true;

    public render(): string {
        return `
            <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex flex-col">
                <!-- Header -->
                <div class="bg-slate-800 border-b border-slate-700 p-4">
                    <div class="flex items-center justify-between max-w-6xl mx-auto">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Dashboard</span>
                            </button>
                            <div class="h-6 w-px bg-slate-600"></div>
                            <h1 class="text-2xl font-bold text-white">Game Menu</h1>
                        </div>
                        <div class="text-sm text-gray-400">
                            Choose your game mode
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 flex items-center justify-center p-8">
                    <div class="max-w-4xl w-full">
                        <!-- Game Mode Cards -->
                        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <!-- Local 2-Player Game -->
                            <div class="bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-500 transition-colors cursor-pointer game-mode-card" data-mode="local">
                                <div class="p-6">
                                    <div class="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                        </svg>
                                    </div>
                                    <h3 class="text-lg font-semibold text-white text-center mb-2">2-Player Local</h3>
                                    <p class="text-sm text-gray-400 text-center mb-4">Play against a friend on the same device</p>
                                    <div class="text-xs text-gray-500 text-center">
                                        Controls: Arrow Keys & W/S
                                    </div>
                                </div>
                            </div>

                            <!-- AI Game -->
                            <div class="bg-slate-800 rounded-lg border border-slate-700 hover:border-green-500 transition-colors cursor-pointer game-mode-card" data-mode="ai">
                                <div class="p-6">
                                    <div class="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                        </svg>
                                    </div>
                                    <h3 class="text-lg font-semibold text-white text-center mb-2">vs AI</h3>
                                    <p class="text-sm text-gray-400 text-center mb-4">Challenge our intelligent AI opponent</p>
                                    <div class="text-xs text-gray-500 text-center">
                                        Challenge the AI and test your skills!
                                    </div>
                                </div>
                            </div>

                            <!-- Tournament -->
                            <div class="bg-slate-800 rounded-lg border border-slate-700 hover:border-purple-500 transition-colors cursor-pointer game-mode-card" data-mode="tournament">
                                <div class="p-6">
                                    <div class="w-16 h-16 bg-purple-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                        </svg>
                                    </div>
                                    <h3 class="text-lg font-semibold text-white text-center mb-2">Tournament</h3>
                                    <p class="text-sm text-gray-400 text-center mb-4">Create or join tournaments with multiple players</p>
                                    <div class="text-xs text-gray-500 text-center">
                                        2-16 players
                                    </div>
                                </div>
                            </div>

                            <!-- Remote Multiplayer -->
                            <div class="bg-slate-800 rounded-lg border border-slate-700 hover:border-orange-500 transition-colors cursor-pointer game-mode-card" data-mode="remote">
                                <div class="p-6">
                                    <div class="w-16 h-16 bg-orange-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
                                        </svg>
                                    </div>
                                    <h3 class="text-lg font-semibold text-white text-center mb-2">Online Match</h3>
                                    <p class="text-sm text-gray-400 text-center mb-4">Play against other players online</p>
                                    <div class="text-xs text-gray-500 text-center">
                                        Real-time multiplayer
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Game Statistics -->
                        <div class="mt-12 bg-slate-800 rounded-lg border border-slate-700 p-6">
                            <h2 class="text-xl font-semibold text-white mb-4 text-center">Game Statistics</h2>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-blue-400">-</div>
                                    <div class="text-sm text-gray-400">Games Played</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-green-400">-</div>
                                    <div class="text-sm text-gray-400">Wins</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-red-400">-</div>
                                    <div class="text-sm text-gray-400">Losses</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-yellow-400">-</div>
                                    <div class="text-sm text-gray-400">Tournaments Won</div>
                                </div>
                            </div>
                        </div>

                        <!-- Recent Games -->
                        <div class="mt-8 bg-slate-800 rounded-lg border border-slate-700 p-6">
                            <h2 class="text-xl font-semibold text-white mb-4">Recent Games</h2>
                            <div class="text-center text-gray-400 py-8">
                                No recent games found. Start playing to see your match history!
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
        await this.loadUserStats();
    }

    public cleanup(): void {
        this.removeEventListeners();
    }

    private bindElements(): void {
        // Elements are bound via event delegation
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
            // Use game-service directly for stats
            const response = await fetch('https://localhost:3004/api/game/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const text = await response.text();
                if (text.trim()) {
                    const data = JSON.parse(text);
                    if (data && data.stats) {
                        this.updateStatsDisplay(data.stats);
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to load user stats:', error);
            // Continue without stats - they'll show as "-"
        }
    }

    private updateStatsDisplay(stats: any): void {
        // Update statistics display with real data
        const statElements = document.querySelectorAll('[data-stat]');
        statElements.forEach(element => {
            const statType = element.getAttribute('data-stat');
            if (statType && stats[statType] !== undefined) {
                element.textContent = stats[statType].toString();
            }
        });
    }
}