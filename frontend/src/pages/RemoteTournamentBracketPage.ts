import { Page } from '../router/Router';
import remoteTournamentService, { Tournament, TournamentMatch, TournamentParticipant } from '../services/remoteTournamentService';
import { showNotification, showError } from '../utils/ui';

export class RemoteTournamentBracketPage implements Page {
    public title = 'Remote Tournament Bracket';
    public requiresAuth = true;

    private tournament: Tournament | null = null;
    private tournamentId: number = 0;
    private matches: TournamentMatch[] = [];
    private groupedMatches: Record<number, TournamentMatch[]> = {};
    private participants: TournamentParticipant[] = [];
    private totalRounds: number = 0;
    private refreshInterval: NodeJS.Timeout | null = null;

    public render(): string {
        return `
            <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900 flex flex-col">
                <!-- Header -->
                <div class="bg-slate-800 border-b border-slate-700 p-4">
                    <div class="flex items-center justify-between max-w-7xl mx-auto">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Lobby</span>
                            </button>
                            <div class="h-6 w-px bg-slate-600"></div>
                            <h1 class="text-2xl font-bold text-white flex items-center">
                                <svg class="w-8 h-8 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
                                </svg>
                                <span id="tournamentTitle">Remote Tournament</span>
                            </h1>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div id="tournamentStats" class="text-sm text-gray-400">
                                Loading...
                            </div>
                            <button id="refreshButton" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">
                                <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 p-6 overflow-auto">
                    <div class="max-w-7xl mx-auto">
                        <div class="grid lg:grid-cols-4 gap-6">
                            <!-- Tournament Status Panel -->
                            <div class="lg:col-span-1 space-y-6">
                                <!-- Tournament Info -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-lg font-semibold text-white mb-4">Tournament Status</h2>
                                    <div class="space-y-3">
                                        <div class="flex justify-between">
                                            <span class="text-gray-300">Current Round:</span>
                                            <span class="text-white font-semibold" id="currentRound">-</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-300">Total Rounds:</span>
                                            <span class="text-white font-semibold" id="totalRounds">-</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-300">Completed Matches:</span>
                                            <span class="text-white font-semibold" id="completedMatches">-</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-300">Active Matches:</span>
                                            <span class="text-white font-semibold" id="activeMatches">-</span>
                                        </div>
                                        <div class="pt-2 border-t border-slate-600">
                                            <div class="text-center">
                                                <div id="tournamentProgress" class="text-lg font-bold text-purple-400">0%</div>
                                                <div class="text-xs text-gray-400">Complete</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Current/Next Match -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-lg font-semibold text-white mb-4">My Match</h2>
                                    <div id="userMatchInfo" class="text-center text-gray-400 py-4">
                                        No active match
                                    </div>
                                </div>

                                <!-- Tournament Winner -->
                                <div id="tournamentWinnerPanel" class="bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-lg border border-yellow-500 p-6 hidden">
                                    <h2 class="text-lg font-semibold text-white mb-4 flex items-center">
                                        <svg class="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732L14.146 12.8l-1.179 4.456a1 1 0 01-1.934 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732L9.854 7.2l1.179-4.456A1 1 0 0112 2z" clip-rule="evenodd"></path>
                                        </svg>
                                        Tournament Winner
                                    </h2>
                                    <div id="tournamentWinner" class="text-center">
                                        <div class="text-2xl font-bold text-white mb-2"></div>
                                        <button id="newTournamentButton" class="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
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
                                            <div class="text-sm text-gray-400 mr-4">
                                                Auto-refresh: <span class="text-green-400">ON</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Bracket Container -->
                                    <div id="bracketContainer" class="min-h-96 bg-slate-900 rounded-lg p-4 overflow-x-auto">
                                        <div class="text-center text-gray-400 py-8">
                                            Loading tournament bracket...
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Match Details Modal -->
                        <div id="matchDetailsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                            <div class="bg-slate-800 rounded-lg border border-slate-700 p-8 max-w-md w-full mx-4">
                                <h3 class="text-xl font-semibold text-white mb-6 text-center">Match Details</h3>
                                <div id="matchDetailsContent" class="space-y-4">
                                    <!-- Match details will be populated here -->
                                </div>
                                <div class="flex space-x-4 mt-8">
                                    <button id="joinMatchButton" class="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors hidden">
                                        Join Match
                                    </button>
                                    <button id="spectateMatchButton" class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors hidden">
                                        Spectate
                                    </button>
                                    <button id="closeModalButton" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        this.parseTournamentId();
        this.bindElements();
        this.attachEventListeners();
        await this.loadTournamentData();
        this.startRefreshInterval();
    }

    public cleanup(): void {
        this.removeEventListeners();
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    private parseTournamentId(): void {
        const pathParts = window.location.pathname.split('/');
        const idIndex = pathParts.indexOf('bracket') + 1;
        const parsedId = idIndex > 0 ? parseInt(pathParts[idIndex]) : NaN;
        
        if (isNaN(parsedId) || parsedId <= 0) {
            showError('Invalid tournament ID');
            this.navigateBack();
            return;
        }
        
        this.tournamentId = parsedId;
    }

    private bindElements(): void {
        // Elements accessed by ID when needed
    }

    private attachEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', this.navigateBack.bind(this));
        }

        const refreshButton = document.getElementById('refreshButton');
        if (refreshButton) {
            refreshButton.addEventListener('click', this.handleRefresh.bind(this));
        }

        const newTournamentButton = document.getElementById('newTournamentButton');
        if (newTournamentButton) {
            newTournamentButton.addEventListener('click', this.handleNewTournament.bind(this));
        }

        const joinMatchButton = document.getElementById('joinMatchButton');
        if (joinMatchButton) {
            joinMatchButton.addEventListener('click', this.handleJoinMatch.bind(this));
        }

        const spectateMatchButton = document.getElementById('spectateMatchButton');
        if (spectateMatchButton) {
            spectateMatchButton.addEventListener('click', this.handleSpectateMatch.bind(this));
        }

        const closeModalButton = document.getElementById('closeModalButton');
        if (closeModalButton) {
            closeModalButton.addEventListener('click', this.hideMatchDetailsModal.bind(this));
        }
    }

    private removeEventListeners(): void {
        // Event listeners are automatically cleaned up
    }

    private async loadTournamentData(): Promise<void> {
        try {
            // Load tournament and matches data
            const [tournament, matchesData] = await Promise.all([
                remoteTournamentService.getTournament(this.tournamentId),
                remoteTournamentService.getTournamentMatches(this.tournamentId)
            ]);

            this.tournament = tournament;
            this.matches = matchesData.matches;
            this.groupedMatches = matchesData.grouped_matches;
            this.totalRounds = matchesData.total_rounds;
            this.participants = tournament.participants || [];

            this.updateUI();
        } catch (error) {
            console.error('Failed to load tournament data:', error);
            showError('Failed to load tournament data');
        }
    }

    private updateUI(): void {
        if (!this.tournament) return;

        this.updateTournamentInfo();
        this.updateBracket();
        this.updateUserMatch();
        this.checkTournamentComplete();
    }

    private updateTournamentInfo(): void {
        if (!this.tournament) return;

        const titleElement = document.getElementById('tournamentTitle');
        const statsElement = document.getElementById('tournamentStats');
        const currentRoundElement = document.getElementById('currentRound');
        const totalRoundsElement = document.getElementById('totalRounds');
        const completedMatchesElement = document.getElementById('completedMatches');
        const activeMatchesElement = document.getElementById('activeMatches');
        const progressElement = document.getElementById('tournamentProgress');

        if (titleElement) {
            titleElement.textContent = this.tournament.name;
        }

        const completedMatches = this.matches.filter(m => m.status === 'finished').length;
        const activeMatches = this.matches.filter(m => m.status === 'active').length;
        const progress = this.matches.length > 0 ? (completedMatches / this.matches.length) * 100 : 0;

        if (statsElement) {
            statsElement.textContent = `Round ${this.tournament.current_round}/${this.totalRounds} • ${this.participants.length} players`;
        }

        if (currentRoundElement) currentRoundElement.textContent = this.tournament.current_round.toString();
        if (totalRoundsElement) totalRoundsElement.textContent = this.totalRounds.toString();
        if (completedMatchesElement) completedMatchesElement.textContent = completedMatches.toString();
        if (activeMatchesElement) activeMatchesElement.textContent = activeMatches.toString();
        if (progressElement) progressElement.textContent = `${Math.round(progress)}%`;
    }

    private updateBracket(): void {
        const container = document.getElementById('bracketContainer');
        if (!container) return;

        if (Object.keys(this.groupedMatches).length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <svg class="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    No matches scheduled yet
                </div>
            `;
            return;
        }

        const rounds = Object.keys(this.groupedMatches).sort((a, b) => parseInt(a) - parseInt(b));
        
        container.innerHTML = `
            <div class="tournament-bracket flex space-x-8 min-w-max pb-4">
                ${rounds.map(roundNum => {
                    const round = parseInt(roundNum);
                    const matches = this.groupedMatches[round] || [];
                    
                    return `
                        <div class="flex flex-col space-y-4 min-w-80">
                            <h3 class="text-center text-white font-semibold mb-4 sticky top-0 bg-slate-900 py-2 rounded">
                                ${this.getRoundName(round, this.totalRounds)}
                            </h3>
                            ${matches.map(match => this.renderMatchCard(match)).join('')}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Add click event listeners to match cards
        container.querySelectorAll('.match-card').forEach(card => {
            card.addEventListener('click', this.handleMatchClick.bind(this));
        });
    }

    private renderMatchCard(match: TournamentMatch): string {
        const isUserMatch = this.isUserInMatch(match);
        const canJoin = this.canUserJoinMatch(match);
        
        return `
            <div class="match-card cursor-pointer bg-slate-700 border border-slate-600 hover:border-purple-500 rounded-lg p-4 ${isUserMatch ? 'ring-2 ring-purple-500' : ''} ${canJoin ? 'ring-2 ring-green-500' : ''}" data-match-id="${match.id}">
                <div class="space-y-2">
                    <!-- Player 1 -->
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            ${match.player1_seed ? `<span class="text-xs text-gray-400">#${match.player1_seed}</span>` : ''}
                            <span class="text-white ${match.winner_id === match.player1_id ? 'font-bold text-green-400' : ''}">${match.player1_username || 'TBD'}</span>
                        </div>
                        <span class="text-gray-400">${this.getMatchScore(match, 'player1')}</span>
                    </div>
                    
                    <!-- Divider -->
                    <div class="w-full h-px bg-slate-600"></div>
                    
                    <!-- Player 2 -->
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            ${match.player2_seed ? `<span class="text-xs text-gray-400">#${match.player2_seed}</span>` : ''}
                            <span class="text-white ${match.winner_id === match.player2_id ? 'font-bold text-green-400' : ''}">${match.player2_username || 'TBD'}</span>
                        </div>
                        <span class="text-gray-400">${this.getMatchScore(match, 'player2')}</span>
                    </div>
                </div>
                
                <!-- Match Status -->
                <div class="mt-3 text-center">
                    ${this.getMatchStatusBadge(match, isUserMatch, canJoin)}
                </div>
            </div>
        `;
    }

    private getMatchScore(match: TournamentMatch, player: 'player1' | 'player2'): string {
        // For now, return placeholder - would need to get from game session
        if (match.status === 'finished') {
            return match.winner_id === match[`${player}_id`] ? '11' : '0';
        }
        return '-';
    }

    private getMatchStatusBadge(match: TournamentMatch, isUserMatch: boolean, canJoin: boolean): string {
        if (canJoin) {
            return '<span class="px-2 py-1 bg-green-600 text-white text-xs rounded animate-pulse">🎮 Join Match</span>';
        }
        
        if (isUserMatch && match.status === 'ready') {
            return '<span class="px-2 py-1 bg-blue-600 text-white text-xs rounded">Your Match</span>';
        }

        switch (match.status) {
            case 'active':
                return '<span class="px-2 py-1 bg-green-600 text-white text-xs rounded">🔴 Live</span>';
            case 'finished':
                return '<span class="px-2 py-1 bg-gray-600 text-white text-xs rounded">✅ Complete</span>';
            case 'ready':
                return '<span class="px-2 py-1 bg-yellow-600 text-white text-xs rounded">⏳ Ready</span>';
            case 'walkover':
                return '<span class="px-2 py-1 bg-orange-600 text-white text-xs rounded">Walkover</span>';
            default:
                return '<span class="px-2 py-1 bg-slate-600 text-white text-xs rounded">Pending</span>';
        }
    }

    private getRoundName(round: number, totalRounds: number): string {
        if (round === totalRounds) return 'Final';
        if (round === totalRounds - 1) return 'Semifinal';
        if (round === totalRounds - 2) return 'Quarterfinal';
        return `Round ${round}`;
    }

    private isUserInMatch(match: TournamentMatch): boolean {
        const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
        return match.player1_id === currentUser.id || match.player2_id === currentUser.id;
    }

    private canUserJoinMatch(match: TournamentMatch): boolean {
        return this.isUserInMatch(match) && match.status === 'ready';
    }

    private updateUserMatch(): void {
        const userMatchElement = document.getElementById('userMatchInfo');
        if (!userMatchElement) return;

        const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
        const userMatches = this.matches.filter(m => 
            m.player1_id === currentUser.id || m.player2_id === currentUser.id
        );

        const activeMatch = userMatches.find(m => m.status === 'ready' || m.status === 'active');

        if (!activeMatch) {
            const nextMatch = userMatches.find(m => m.status === 'pending');
            if (nextMatch) {
                userMatchElement.innerHTML = `
                    <div class="text-gray-400">
                        <div class="text-sm mb-2">Next Match:</div>
                        <div class="text-white font-semibold">Round ${nextMatch.round_number}</div>
                        <div class="text-sm mt-1">Waiting for bracket progression</div>
                    </div>
                `;
            } else {
                userMatchElement.innerHTML = `
                    <div class="text-gray-400">
                        No active match
                    </div>
                `;
            }
            return;
        }

        const opponent = activeMatch.player1_id === currentUser.id ? 
            activeMatch.player2_username : activeMatch.player1_username;

        userMatchElement.innerHTML = `
            <div class="space-y-3">
                <div class="text-sm text-gray-400">Round ${activeMatch.round_number} - Match ${activeMatch.match_number}</div>
                <div class="space-y-2">
                    <div class="text-white font-semibold">vs ${opponent}</div>
                </div>
                ${activeMatch.status === 'ready' ? `
                    <button class="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-sm" onclick="window.dispatchEvent(new CustomEvent('navigate', {detail: {path: '/game/tournament/remote/match/${activeMatch.id}'}}))">
                        Join Match
                    </button>
                ` : activeMatch.status === 'active' ? `
                    <div class="text-green-400 text-sm">🔴 Match in progress</div>
                ` : ''}
            </div>
        `;
    }

    private checkTournamentComplete(): void {
        if (!this.tournament || this.tournament.status !== 'finished') return;

        const winnerPanel = document.getElementById('tournamentWinnerPanel');
        const winnerElement = document.getElementById('tournamentWinner');
        
        if (winnerPanel && winnerElement && this.tournament.winner_id) {
            const winner = this.participants.find(p => p.user_id === this.tournament!.winner_id);
            if (winner) {
                winnerPanel.classList.remove('hidden');
                const winnerDisplay = winnerElement.querySelector('.text-2xl');
                if (winnerDisplay) {
                    winnerDisplay.textContent = `🏆 ${winner.username}`;
                }
            }
        }
    }

    private startRefreshInterval(): void {
        if (!this.tournamentId || this.tournamentId <= 0) {
            console.warn('Cannot start refresh interval: Invalid tournament ID');
            return;
        }
        
        this.refreshInterval = setInterval(async () => {
            await this.loadTournamentData();
        }, 3000); // Refresh every 3 seconds for live updates
    }

    private async handleRefresh(): Promise<void> {
        await this.loadTournamentData();
        showNotification('Bracket refreshed', 'info');
    }

    private handleMatchClick(event: Event): void {
        const card = event.currentTarget as HTMLElement;
        const matchId = parseInt(card.getAttribute('data-match-id') || '0');
        const match = this.matches.find(m => m.id === matchId);
        
        if (match) {
            this.showMatchDetails(match);
        }
    }

    private showMatchDetails(match: TournamentMatch): void {
        const modal = document.getElementById('matchDetailsModal');
        const content = document.getElementById('matchDetailsContent');
        const joinButton = document.getElementById('joinMatchButton');
        const spectateButton = document.getElementById('spectateMatchButton');

        if (!modal || !content) return;

        const isUserMatch = this.isUserInMatch(match);
        const canJoin = this.canUserJoinMatch(match);

        content.innerHTML = `
            <div class="text-center">
                <div class="text-lg text-gray-300 mb-4">Round ${match.round_number} - Match ${match.match_number}</div>
                <div class="space-y-2 mb-4">
                    <div class="text-white font-semibold">${match.player1_username || 'TBD'}</div>
                    <div class="text-gray-400">vs</div>
                    <div class="text-white font-semibold">${match.player2_username || 'TBD'}</div>
                </div>
                <div class="text-sm text-gray-400 mb-4">
                    Status: ${match.status}${match.bracket_position ? ` | Position: ${match.bracket_position}` : ''}
                </div>
                ${match.winner_username ? `
                    <div class="text-green-400 font-semibold">
                        Winner: ${match.winner_username}
                    </div>
                ` : ''}
            </div>
        `;

        // Show/hide action buttons
        if (joinButton) {
            if (canJoin) {
                joinButton.classList.remove('hidden');
                joinButton.setAttribute('data-match-id', match.id.toString());
            } else {
                joinButton.classList.add('hidden');
            }
        }

        if (spectateButton) {
            if (match.status === 'active' && !isUserMatch) {
                spectateButton.classList.remove('hidden');
                spectateButton.setAttribute('data-match-id', match.id.toString());
            } else {
                spectateButton.classList.add('hidden');
            }
        }

        modal.classList.remove('hidden');
    }

    private hideMatchDetailsModal(): void {
        const modal = document.getElementById('matchDetailsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    private handleJoinMatch(): void {
        const joinButton = document.getElementById('joinMatchButton');
        const matchId = joinButton?.getAttribute('data-match-id');
        
        if (matchId) {
            const event = new CustomEvent('navigate', {
                detail: { path: `/game/tournament/remote/match/${matchId}` }
            });
            window.dispatchEvent(event);
        }
    }

    private handleSpectateMatch(): void {
        const spectateButton = document.getElementById('spectateMatchButton');
        const matchId = spectateButton?.getAttribute('data-match-id');
        
        if (matchId) {
            const event = new CustomEvent('navigate', {
                detail: { path: `/game/tournament/remote/match/${matchId}?spectate=true` }
            });
            window.dispatchEvent(event);
        }
    }

    private handleNewTournament(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: '/game/tournament/setup' }
        });
        window.dispatchEvent(event);
    }

    private navigateBack(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: `/game/tournament/remote/lobby/${this.tournamentId}` }
        });
        window.dispatchEvent(event);
    }
}