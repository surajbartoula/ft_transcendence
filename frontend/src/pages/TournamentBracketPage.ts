import { Page } from '../router/Router';
import { TournamentManager, Tournament, TournamentMatch } from '../babylonjs/TournamentManager';
import { showNotification, showError } from '../utils/ui';

export class TournamentBracketPage implements Page {
    public title = 'Tournament Bracket';
    public requiresAuth = true;

    private tournamentManager: TournamentManager;
    private tournament: Tournament | null = null;
    private currentMatch: TournamentMatch | null = null;

    constructor() {
        this.tournamentManager = TournamentManager.getInstance();
    }

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
                    <div class="flex items-center justify-between max-w-7xl mx-auto">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors tron-glow">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Setup</span>
                            </button>
                            <div class="h-6 w-px bg-cyan-500/30"></div>
                            <h1 class="text-2xl font-bold text-cyan-400 flex items-center">
                                <svg class="w-8 h-8 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                                <span id="tournamentTitle">Tournament Bracket</span>
                            </h1>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div id="tournamentStats" class="text-sm text-cyan-300">
                                Loading tournament...
                            </div>
                            <button id="startNextMatchButton" class="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed tron-glow" disabled>
                                Start Next Match
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 p-6 overflow-auto relative z-10 bg-slate-900/50 backdrop-blur-sm">
                    <div class="max-w-7xl mx-auto">
                        <div class="grid lg:grid-cols-4 gap-6">
                            <!-- Tournament Info Panel -->
                            <div class="lg:col-span-1 space-y-6">
                                <!-- Tournament Status -->
                                <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <h2 class="text-lg font-semibold text-cyan-300 mb-4">Tournament Status</h2>
                                    <div class="space-y-3">
                                        <div class="flex justify-between">
                                            <span class="text-cyan-300">Current Round:</span>
                                            <span class="text-white font-semibold" id="currentRound">-</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-cyan-300">Total Rounds:</span>
                                            <span class="text-white font-semibold" id="totalRounds">-</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-cyan-300">Completed Matches:</span>
                                            <span class="text-white font-semibold" id="completedMatches">-</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-cyan-300">Remaining Players:</span>
                                            <span class="text-white font-semibold" id="remainingPlayers">-</span>
                                        </div>
                                        <div class="pt-2 border-t border-cyan-500/30">
                                            <div class="text-center">
                                                <div id="tournamentProgress" class="text-lg font-bold text-purple-400">0%</div>
                                                <div class="text-xs text-cyan-400">Complete</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Current Match Info -->
                                <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <h2 class="text-lg font-semibold text-cyan-300 mb-4">Current Match</h2>
                                    <div id="currentMatchInfo" class="text-center text-cyan-400 py-4">
                                        No active match
                                    </div>
                                </div>

                                <!-- Tournament Winner -->
                                <div id="tournamentWinnerPanel" class="bg-gradient-to-r from-yellow-600/70 to-yellow-700/70 backdrop-blur-sm rounded-lg border border-yellow-500/50 p-6 hidden tron-border tron-glow">
                                    <h2 class="text-lg font-semibold text-white mb-4 flex items-center">
                                        <svg class="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732L14.146 12.8l-1.179 4.456a1 1 0 01-1.934 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732L9.854 7.2l1.179-4.456A1 1 0 0112 2z" clip-rule="evenodd"></path>
                                        </svg>
                                        Tournament Winner
                                    </h2>
                                    <div id="tournamentWinner" class="text-center">
                                        <div class="text-2xl font-bold text-white mb-2"></div>
                                        <button id="newTournamentButton" class="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-lg transition-all tron-glow">
                                            New Tournament
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Tournament Bracket -->
                            <div class="lg:col-span-3">
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <div class="flex items-center justify-between mb-6">
                                        <h2 class="text-xl font-semibold text-white">Tournament Bracket</h2>
                                        <div class="flex space-x-2">
                                            <button id="refreshBracketButton" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">
                                                <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                                </svg>
                                                Refresh
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <!-- Bracket Container -->
                                    <div id="bracketContainer" class="min-h-96 bg-slate-900 rounded-lg p-4">
                                        <div class="text-center text-gray-400 py-8">
                                            Loading tournament bracket...
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Upcoming Matches -->
                        <div class="mt-6 bg-slate-800 rounded-lg border border-slate-700 p-6">
                            <h2 class="text-xl font-semibold text-white mb-4">Upcoming Matches</h2>
                            <div id="upcomingMatches" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div class="text-center text-gray-400 py-4">
                                    No upcoming matches
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Match Result Modal -->
                <div id="matchResultModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                    <div class="bg-slate-900/90 backdrop-blur-md rounded-lg border border-cyan-500/50 p-8 max-w-md w-full mx-4 tron-border tron-glow">
                        <h3 class="text-xl font-semibold text-cyan-400 mb-6 text-center">Match Result</h3>
                        <div id="matchResultContent" class="space-y-4">
                            <div class="text-center">
                                <div id="matchPlayers" class="text-lg text-cyan-300 mb-4"></div>
                                <div id="matchScore" class="text-2xl font-bold text-white mb-4"></div>
                                <div id="matchWinner" class="text-lg text-cyan-400 font-semibold"></div>
                            </div>
                        </div>
                        <div class="flex space-x-4 mt-8">
                            <button id="continueButton" class="flex-1 py-2 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-lg transition-all tron-glow">
                                Continue Tournament
                            </button>
                            <button id="closeModalButton" class="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/70 border border-cyan-500/30 text-cyan-300 rounded-lg transition-all tron-glow">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        this.attachEventListeners();
        await this.loadTournament();
    }

    public cleanup(): void {
        this.removeEventListeners();
    }

    private attachEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', this.handleBackClick.bind(this));
        }

        const startNextMatchButton = document.getElementById('startNextMatchButton');
        if (startNextMatchButton) {
            startNextMatchButton.addEventListener('click', this.handleStartNextMatch.bind(this));
        }

        const refreshBracketButton = document.getElementById('refreshBracketButton');
        if (refreshBracketButton) {
            refreshBracketButton.addEventListener('click', this.refreshBracket.bind(this));
        }

        const newTournamentButton = document.getElementById('newTournamentButton');
        if (newTournamentButton) {
            newTournamentButton.addEventListener('click', this.handleNewTournament.bind(this));
        }

        const continueButton = document.getElementById('continueButton');
        if (continueButton) {
            continueButton.addEventListener('click', this.handleContinueTournament.bind(this));
        }

        const closeModalButton = document.getElementById('closeModalButton');
        if (closeModalButton) {
            closeModalButton.addEventListener('click', this.hideMatchResultModal.bind(this));
        }
    }

    private removeEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.removeEventListener('click', this.handleBackClick.bind(this));
        }

        const startNextMatchButton = document.getElementById('startNextMatchButton');
        if (startNextMatchButton) {
            startNextMatchButton.removeEventListener('click', this.handleStartNextMatch.bind(this));
        }

        const refreshBracketButton = document.getElementById('refreshBracketButton');
        if (refreshBracketButton) {
            refreshBracketButton.removeEventListener('click', this.refreshBracket.bind(this));
        }

        const newTournamentButton = document.getElementById('newTournamentButton');
        if (newTournamentButton) {
            newTournamentButton.removeEventListener('click', this.handleNewTournament.bind(this));
        }

        const continueButton = document.getElementById('continueButton');
        if (continueButton) {
            continueButton.removeEventListener('click', this.handleContinueTournament.bind(this));
        }

        const closeModalButton = document.getElementById('closeModalButton');
        if (closeModalButton) {
            closeModalButton.removeEventListener('click', this.hideMatchResultModal.bind(this));
        }
    }

    private async loadTournament(): Promise<void> {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const playersParam = urlParams.get('players');
            const tournamentName = urlParams.get('name') || 'Tournament';

            if (!playersParam) {
                showError('No tournament data found');
                this.handleBackClick();
                return;
            }

            const players = JSON.parse(decodeURIComponent(playersParam));
            
            // Check if a tournament already exists for these players
            const existingTournament = this.tournamentManager.findTournamentByPlayers(players);
            
            if (existingTournament) {
                this.tournament = existingTournament;
            } else {
                this.tournament = this.tournamentManager.createTournament(players);
            }
            
            // Update tournament title
            const titleElement = document.getElementById('tournamentTitle');
            if (titleElement) {
                titleElement.textContent = tournamentName;
            }

            this.updateTournamentInfo();
            this.renderBracket();
            this.updateUpcomingMatches();
            this.checkForNextMatch();
            // showNotification('Tournament loaded successfully!', 'success');
        } catch (error) {
            showError('Failed to load tournament data');
            this.handleBackClick();
        }
    }

    private updateTournamentInfo(): void {
        if (!this.tournament) return;

        const stats = this.tournamentManager.getTournamentStats(this.tournament.id);
        
        const currentRound = document.getElementById('currentRound');
        const totalRounds = document.getElementById('totalRounds');
        const completedMatches = document.getElementById('completedMatches');
        const remainingPlayers = document.getElementById('remainingPlayers');
        const tournamentProgress = document.getElementById('tournamentProgress');
        const tournamentStats = document.getElementById('tournamentStats');

        if (currentRound) currentRound.textContent = stats.currentRound.toString();
        if (totalRounds) totalRounds.textContent = stats.totalRounds.toString();
        if (completedMatches) completedMatches.textContent = stats.completedMatches.toString();
        if (remainingPlayers) remainingPlayers.textContent = stats.remainingPlayers.toString();
        
        const progress = (stats.completedMatches / stats.totalMatches) * 100;
        
        if (tournamentProgress) {
            tournamentProgress.textContent = `${Math.round(progress)}%`;
        }

        if (tournamentStats) {
            tournamentStats.textContent = `Round ${stats.currentRound}/${stats.totalRounds} • ${stats.remainingPlayers} players left`;
        }

        // Check if tournament is complete
        if (this.tournament.isComplete && this.tournament.winner) {
            this.showTournamentWinner(this.tournament.winner);
        }
    }

    private renderBracket(): void {
        if (!this.tournament) return;

        const container = document.getElementById('bracketContainer');
        if (!container) return;

        const bracket = this.tournamentManager.getTournamentBracket(this.tournament.id);
        
        container.innerHTML = `
            <div class="tournament-bracket flex space-x-8 overflow-x-auto pb-4">
                ${bracket.rounds.map((round, roundIndex) => `
                    <div class="flex flex-col space-y-4 min-w-60">
                        <h3 class="text-center text-cyan-400 font-semibold mb-4 tron-glow">
                            ${roundIndex === bracket.rounds.length - 1 ? 'Final' : 
                              roundIndex === bracket.rounds.length - 2 ? 'Semifinal' :
                              `Round ${roundIndex + 1}`}
                        </h3>
                        ${round.map(match => `
                            <div class="match-card bg-slate-900/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 ${match.isComplete ? 'opacity-75' : ''} tron-border tron-glow">
                                <div class="space-y-2">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center space-x-2">
                                            <div class="w-2 h-2 bg-cyan-400 rounded-full" title="Left side"></div>
                                            <span class="text-white ${match.winner?.id === match.player1.id ? 'font-bold text-cyan-400' : ''}">${match.player1.name}</span>
                                        </div>
                                        <div class="flex items-center space-x-2">
                                            <span class="text-cyan-300">${match.score ? match.score.player1 : '-'}</span>
                                            <span class="text-xs text-cyan-400/70">L</span>
                                        </div>
                                    </div>
                                    <div class="w-full h-px bg-cyan-500/30"></div>
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center space-x-2">
                                            <div class="w-2 h-2 bg-cyan-400 rounded-full" title="Right side"></div>
                                            <span class="text-white ${match.winner?.id === match.player2.id ? 'font-bold text-cyan-400' : ''}">${match.player2.name}</span>
                                        </div>
                                        <div class="flex items-center space-x-2">
                                            <span class="text-cyan-300">${match.score ? match.score.player2 : '-'}</span>
                                            <span class="text-xs text-cyan-400/70">R</span>
                                        </div>
                                    </div>
                                </div>
                                ${!match.isComplete && this.currentMatch?.id === match.id ? `
                                    <div class="mt-2 text-center">
                                        <span class="px-2 py-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-xs rounded tron-glow">Playing</span>
                                    </div>
                                ` : match.isComplete ? `
                                    <div class="mt-2 text-center">
                                        <span class="px-2 py-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs rounded tron-glow">Complete</span>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    }

    private updateUpcomingMatches(): void {
        if (!this.tournament) return;

        const upcomingMatches = this.tournamentManager.getUpcomingMatches(this.tournament.id, 6);
        const container = document.getElementById('upcomingMatches');
        
        if (!container) return;

        if (upcomingMatches.length === 0) {
            container.innerHTML = `
                <div class="text-center text-cyan-400/70 py-4 col-span-full">
                    No upcoming matches
                </div>
            `;
            return;
        }

        container.innerHTML = upcomingMatches.map(match => `
            <div class="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-4 tron-border tron-glow">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm text-cyan-400">Round ${match.roundNumber}</span>
                    <span class="text-sm text-cyan-400">Match ${match.matchNumber}</span>
                </div>
                <div class="space-y-2">
                    <div class="flex items-center space-x-2">
                        <div class="w-2 h-2 bg-cyan-400 rounded-full" title="Left side"></div>
                        <div class="text-white font-medium">${match.player1.name}</div>
                        <span class="text-xs text-cyan-400/70 ml-auto">LEFT</span>
                    </div>
                    <div class="text-center text-cyan-300 text-sm">vs</div>
                    <div class="flex items-center space-x-2">
                        <div class="w-2 h-2 bg-cyan-400 rounded-full" title="Right side"></div>
                        <div class="text-white font-medium">${match.player2.name}</div>
                        <span class="text-xs text-cyan-400/70 ml-auto">RIGHT</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    private updateCurrentMatch(): void {
        if (!this.tournament) return;

        this.currentMatch = this.tournamentManager.getNextMatch(this.tournament.id);
        const container = document.getElementById('currentMatchInfo');
        
        if (!container) return;

        if (!this.currentMatch) {
            container.innerHTML = `
                <div class="text-cyan-400/70">
                    ${this.tournament.isComplete ? 'Tournament Complete!' : 'No active match'}
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="space-y-3">
                <div class="text-sm text-cyan-400">Round ${this.currentMatch.roundNumber} - Match ${this.currentMatch.matchNumber}</div>
                <div class="space-y-2">
                    <div class="flex items-center justify-between bg-slate-900/50 backdrop-blur-sm rounded-lg p-3 border border-cyan-500/30 tron-glow">
                        <div class="flex items-center space-x-2">
                            <div class="w-3 h-3 bg-cyan-400 rounded-full" title="Left side"></div>
                            <div class="text-white font-semibold">${this.currentMatch.player1.name}</div>
                        </div>
                        <div class="text-xs text-cyan-400 bg-slate-800/70 px-2 py-1 rounded border border-cyan-500/30">LEFT</div>
                    </div>
                    <div class="text-center text-cyan-300 text-sm font-medium">VS</div>
                    <div class="flex items-center justify-between bg-slate-900/50 backdrop-blur-sm rounded-lg p-3 border border-cyan-500/30 tron-glow">
                        <div class="flex items-center space-x-2">
                            <div class="w-3 h-3 bg-cyan-400 rounded-full" title="Right side"></div>
                            <div class="text-white font-semibold">${this.currentMatch.player2.name}</div>
                        </div>
                        <div class="text-xs text-cyan-400 bg-slate-800/70 px-2 py-1 rounded border border-cyan-500/30">RIGHT</div>
                    </div>
                </div>
            </div>
        `;
    }

    private checkForNextMatch(): void {
        this.updateCurrentMatch();
        
        const startButton = document.getElementById('startNextMatchButton') as HTMLButtonElement;
        if (startButton) {
            startButton.disabled = !this.currentMatch || this.tournament?.isComplete || false;
        }
    }

    private showTournamentWinner(winner: any): void {
        const panel = document.getElementById('tournamentWinnerPanel');
        const winnerElement = document.getElementById('tournamentWinner');
        
        if (panel && winnerElement) {
            panel.classList.remove('hidden');
            winnerElement.querySelector('.text-2xl')!.textContent = `🏆 ${winner.name}`;
        }
    }

    private showMatchResultModal(match: TournamentMatch): void {
        const modal = document.getElementById('matchResultModal');
        const players = document.getElementById('matchPlayers');
        const score = document.getElementById('matchScore');
        const winner = document.getElementById('matchWinner');
        
        if (modal && players && score && winner && match.winner && match.score) {
            players.textContent = `${match.player1.name} vs ${match.player2.name}`;
            score.textContent = `${match.score.player1} - ${match.score.player2}`;
            winner.textContent = `🏆 ${match.winner.name} wins!`;
            modal.classList.remove('hidden');
        }
    }

    private hideMatchResultModal(): void {
        const modal = document.getElementById('matchResultModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    private refreshBracket(): void {
        this.updateTournamentInfo();
        this.renderBracket();
        this.updateUpcomingMatches();
        this.checkForNextMatch();
        // showNotification('Bracket refreshed', 'info');
    }

    private handleBackClick(): void {
        // Clear all tournament data to allow fresh start
        this.tournamentManager.clearAllTournaments();
        const event = new CustomEvent('navigate', {
            detail: { path: '/game/tournament/setup' }
        });
        window.dispatchEvent(event);
    }

    private handleStartNextMatch(): void {
        if (!this.currentMatch || !this.tournament) {
            showError('Cannot start match: tournament data missing');
            return;
        }

        // Navigate to the shared game page for local tournament match
        const navigationPath = `/game/play?mode=local&player1=${encodeURIComponent(this.currentMatch.player1.name)}&player2=${encodeURIComponent(this.currentMatch.player2.name)}&tournamentId=${this.tournament.id}&matchId=${this.currentMatch.id}`;
        
        const event = new CustomEvent('navigate', {
            detail: { path: navigationPath }
        });
        window.dispatchEvent(event);
    }

    private handleNewTournament(): void {
        // Clear/delete the current tournament to ensure fresh start
        if (this.tournament) {
            this.tournamentManager.deleteTournament(this.tournament.id);
            this.tournament = null;
        }
        
        const event = new CustomEvent('navigate', {
            detail: { path: '/game/tournament/setup' }
        });
        window.dispatchEvent(event);
    }

    private handleContinueTournament(): void {
        this.hideMatchResultModal();
        this.refreshBracket();
    }
}