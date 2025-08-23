import { Page } from '../router/Router';
import { PongGameManager } from '../babylonjs/PongManager';
import remoteTournamentService, { Tournament, TournamentMatch, GameSession } from '../services/remoteTournamentService';
import { showNotification, showError } from '../utils/ui';

export class RemoteTournamentGamePage implements Page {
    public title = 'Tournament Match';
    public requiresAuth = true;
    
    private gameManager: PongGameManager | null = null;
    private gameCanvas: HTMLCanvasElement | null = null;
    private isGameInitialized: boolean = false;
    private tournamentId: number = 0;
    private matchId: number = 0;
    private match: TournamentMatch | null = null;
    private tournament: Tournament | null = null;
    private gameSession: GameSession | null = null;
    private isSpectator: boolean = false;
    private player1Name: string = 'Player 1';
    private player2Name: string = 'Player 2';
    private gameCompletedCallback: ((winner: string, score: {player1: number, player2: number}) => void) | null = null;

    public render(): string {
        return `
            <div class="fixed inset-0 bg-slate-900 flex flex-col h-screen">
                <!-- Tournament Match Header -->
                <div class="bg-slate-800 border-b border-slate-700 p-3 z-20 relative">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors z-30 relative">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Bracket</span>
                            </button>
                            <div class="h-6 w-px bg-slate-600"></div>
                            <h1 class="text-lg font-bold text-white flex items-center">
                                <svg class="w-6 h-6 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
                                </svg>
                                <span id="matchTitle">Tournament Match</span>
                            </h1>
                            <div id="tournamentRound" class="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                                Loading...
                            </div>
                            <div id="spectatorBadge" class="px-2 py-1 bg-blue-600 text-white text-xs rounded hidden">
                                Spectating
                            </div>
                        </div>
                        
                        <div class="flex items-center space-x-3">
                            <div class="text-xs text-gray-400 hidden sm:block">
                                <span class="text-blue-400">↑↓</span> Left | 
                                <span class="text-orange-400">WS</span> Right | 
                                <span class="text-green-400">Space</span> Pause
                            </div>
                            <button id="fullscreenButton" class="text-gray-300 hover:text-white transition-colors p-2 rounded z-30 relative">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Tournament Match Status Bar -->
                    <div class="mt-2 flex items-center justify-between text-xs text-gray-400">
                        <div class="flex items-center space-x-4">
                            <div id="matchStatus">Initializing...</div>
                            <div class="flex items-center space-x-2">
                                <span id="player1Name" class="text-blue-400 font-semibold"></span>
                                <span>vs</span>
                                <span id="player2Name" class="text-orange-400 font-semibold"></span>
                            </div>
                        </div>
                        <div id="gameStats" class="flex space-x-4">
                            <span id="currentScore">Score: 0 - 0</span>
                        </div>
                    </div>
                </div>

                <!-- Game Container -->
                <div id="gameContainer" class="flex-1 relative bg-black overflow-hidden">
                    <!-- Loading State -->
                    <div id="gameLoading" class="absolute inset-0 flex items-center justify-center bg-slate-900">
                        <div class="text-center">
                            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                            <p class="text-white text-lg">Loading Tournament Match...</p>
                            <p class="text-gray-400 text-sm mt-2" id="loadingMessage">Preparing tournament systems</p>
                        </div>
                    </div>
                    
                    <!-- Game Canvas -->
                    <canvas 
                        id="gameCanvas" 
                        class="w-full h-full block"
                        style="display: none;"
                    ></canvas>
                    
                    <!-- Error State -->
                    <div id="gameError" class="absolute inset-0 flex items-center justify-center bg-slate-900" style="display: none;">
                        <div class="text-center max-w-md mx-auto p-6">
                            <div class="text-red-500 text-6xl mb-4">⚠️</div>
                            <h2 class="text-white text-xl font-bold mb-2">Match Failed to Load</h2>
                            <p class="text-gray-400 mb-4" id="errorMessage">
                                Unable to initialize the tournament match.
                            </p>
                            <div class="space-y-2">
                                <button id="retryButton" class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded mr-2">
                                    Retry
                                </button>
                                <button id="backToBracketButton" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded">
                                    Back to Bracket
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Pause Overlay -->

                    <!-- Match Complete Overlay -->
                    <div id="matchCompleteOverlay" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-20" style="display: none;">
                        <div class="text-center max-w-md mx-auto p-8">
                            <div class="text-6xl mb-4">🏆</div>
                            <h2 class="text-white text-3xl font-bold mb-4">Match Complete!</h2>
                            <div id="matchResult" class="mb-6">
                                <div id="winnerDisplay" class="text-2xl font-semibold text-green-400 mb-2"></div>
                                <div id="finalScore" class="text-lg text-gray-300 mb-4"></div>
                                <div class="text-sm text-gray-400">
                                    <div id="matchDetails"></div>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <button id="continueTournamentButton" class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold">
                                    Continue Tournament
                                </button>
                                <button id="viewBracketButton" class="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                                    View Bracket
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tournament Progress -->
                <div class="bg-slate-800 border-t border-slate-700 p-2">
                    <div class="flex items-center justify-between max-w-4xl mx-auto text-xs text-gray-400">
                        <div id="tournamentProgress">Tournament Progress: Loading...</div>
                        <div id="nextMatch">Next: TBD</div>
                    </div>
                </div>

                <!-- Notifications Container -->
                <div id="notifications" class="fixed top-20 right-4 z-40 pointer-events-none"></div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        console.log('🏆 Initializing Tournament Match Page...');
        
        this.parseMatchParameters();
        this.bindElements();
        this.attachEventListeners();

        setTimeout(() => {
            this.initializeMatch();
        }, 100);
    }

    public cleanup(): void {
        console.log('🏆 Cleaning up Tournament Match Page...');
        
        if (this.gameManager) {
            try {
                this.gameManager.dispose();
                console.log('✅ Game manager disposed successfully');
            } catch (error) {
                console.warn('⚠️ Error disposing game manager:', error);
            }
            this.gameManager = null;
        }
        
        this.removeEventListeners();

        const notificationsContainer = document.getElementById('notifications');
        if (notificationsContainer) {
            notificationsContainer.innerHTML = '';
        }
        
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(console.warn);
        }
        
        this.isGameInitialized = false;
    }

    private parseMatchParameters(): void {
        const pathParts = window.location.pathname.split('/');
        const matchIndex = pathParts.indexOf('match') + 1;
        this.matchId = matchIndex > 0 ? parseInt(pathParts[matchIndex]) || 0 : 0;
        
        const urlParams = new URLSearchParams(window.location.search);
        this.isSpectator = urlParams.get('spectate') === 'true';

        console.log(`🏆 Tournament Match ID: ${this.matchId}, Spectator: ${this.isSpectator}`);
    }

    private bindElements(): void {
        this.gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    }

    private attachEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', this.handleBackClick.bind(this));
        }

        const fullscreenButton = document.getElementById('fullscreenButton');
        if (fullscreenButton) {
            fullscreenButton.addEventListener('click', this.handleFullscreenClick.bind(this));
        }

        // Error handling buttons
        const retryButton = document.getElementById('retryButton');
        if (retryButton) {
            retryButton.addEventListener('click', this.handleRetry.bind(this));
        }

        const backToBracketButton = document.getElementById('backToBracketButton');
        if (backToBracketButton) {
            backToBracketButton.addEventListener('click', this.handleBackClick.bind(this));
        }


        // Match complete buttons
        const continueTournamentButton = document.getElementById('continueTournamentButton');
        if (continueTournamentButton) {
            continueTournamentButton.addEventListener('click', this.handleContinueTournament.bind(this));
        }

        const viewBracketButton = document.getElementById('viewBracketButton');
        if (viewBracketButton) {
            viewBracketButton.addEventListener('click', this.handleBackClick.bind(this));
        }

        // System events
        document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
        window.addEventListener('resize', this.handleWindowResize.bind(this));

        
        if (this.gameCanvas) {
            this.gameCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
        }
    }

    private removeEventListeners(): void {
        document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
        window.removeEventListener('resize', this.handleWindowResize);

    }

    private async initializeMatch(): Promise<void> {
        if (!this.gameCanvas) {
            console.error('❌ Game canvas not found');
            this.showError('Game canvas not available');
            return;
        }

        if (!this.matchId) {
            console.error('❌ Missing match ID');
            this.showError('Invalid match parameters');
            return;
        }

        try {
            console.log('🏆 Starting tournament match initialization...');
            
            this.updateLoadingMessage('Loading match data...');
            await this.loadMatchData();
            
            if (!this.checkWebGLSupport()) {
                throw new Error('WebGL is not supported in this browser');
            }

            this.updateLoadingMessage('Creating game session...');
            await this.createGameSession();
            
            this.updateLoadingMessage('Loading game engine...');
            this.showGameState();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('🏓 Creating Tournament Game Manager...');
            this.gameManager = new PongGameManager(this.gameCanvas);
            
            await new Promise(resolve => setTimeout(resolve, 1500));

            if (this.gameManager) {
                console.log('✅ Tournament match initialized successfully!');
                this.isGameInitialized = true;

                this.updateLoadingMessage('Starting tournament match...');
                await this.startTournamentMatch();
                this.setupMatchMonitoring();

                if ((this.gameManager as any)?.renderEngine?.engine) {
                    (this.gameManager as any).renderEngine.engine.resize();
                    console.log('🔄 Forced resize after initialization');
                }

                showNotification(`Tournament match started: ${this.player1Name} vs ${this.player2Name}`, 'success', 3000);
            } else {
                throw new Error('Tournament game manager failed to initialize');
            }
        } catch (error) {
            console.error('❌ Failed to initialize tournament match:', error);
            this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
        }
    }

    private updateLoadingMessage(message: string): void {
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
    }

    private updateMatchInfo(): void {
        const player1Element = document.getElementById('player1Name');
        const player2Element = document.getElementById('player2Name');
        const tournamentRound = document.getElementById('tournamentRound');
        const pausePlayer1 = document.getElementById('pausePlayer1');
        const pausePlayer2 = document.getElementById('pausePlayer2');
        const matchTitle = document.getElementById('matchTitle');
        const spectatorBadge = document.getElementById('spectatorBadge');
        
        if (player1Element) player1Element.textContent = this.player1Name;
        if (player2Element) player2Element.textContent = this.player2Name;
        if (pausePlayer1) pausePlayer1.textContent = this.player1Name;
        if (pausePlayer2) pausePlayer2.textContent = this.player2Name;
        
        if (matchTitle && this.match) {
            matchTitle.textContent = `Round ${this.match.round_number} - Match ${this.match.match_number}`;
        }
        
        if (tournamentRound && this.match) {
            tournamentRound.textContent = `Round ${this.match.round_number}`;
        }
        
        if (spectatorBadge) {
            if (this.isSpectator) {
                spectatorBadge.classList.remove('hidden');
            } else {
                spectatorBadge.classList.add('hidden');
            }
        }
    }

    private async startTournamentMatch(): Promise<void> {
        if (!this.gameManager || !this.gameSession) return;

        try {
            // Update game session status to active
            await remoteTournamentService.updateGameSession(this.gameSession.id, {
                status: 'active',
                started_at: new Date().toISOString()
            });
            
            // Initialize game based on spectator mode
            if (this.isSpectator) {
                // For spectators, initialize in view-only mode
                await this.gameManager.startLocalGame(this.player1Name, this.player2Name);
            } else {
                // For players, start normal game
                await this.gameManager.startLocalGame(this.player1Name, this.player2Name);
            }
            
            // Set up game completion callback
            this.setupGameCompletionHandler();
            
        } catch (error) {
            console.error('❌ Failed to start tournament match:', error);
            showError(`Failed to start match: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private setupGameCompletionHandler(): void {
        // This would typically listen to game events to detect when a match is complete
        // For now, we'll set up a basic monitoring system
        this.gameCompletedCallback = (winner: string, score: {player1: number, player2: number}) => {
            this.handleMatchComplete(winner, score);
        };
    }

    private setupMatchMonitoring(): void {
        if (!this.gameManager) return;

        setInterval(() => {
            this.updateMatchStatusDisplay();
            this.checkForMatchCompletion();
        }, 1000);
    }

    private updateMatchStatusDisplay(): void {
        if (!this.gameManager) return;

        try {
            const score = this.gameManager.getScore();
            
            // Update score display
            const currentScore = document.getElementById('currentScore');
            if (currentScore) {
                currentScore.textContent = `Score: ${score.left} - ${score.right}`;
            }

            // Update match status
            const matchStatus = document.getElementById('matchStatus');
            if (matchStatus) {
                matchStatus.textContent = 'Playing';
            }

            // Update tournament progress
            const tournamentProgress = document.getElementById('tournamentProgress');
            if (tournamentProgress && this.tournament && this.match) {
                tournamentProgress.textContent = `${this.tournament.name} | Round ${this.match.round_number}`;
            }

        } catch (error) {
            console.warn('⚠️ Error updating match status display:', error);
        }
    }

    private checkForMatchCompletion(): void {
        if (!this.gameManager) return;

        const score = this.gameManager.getScore();
        const winningScore = 7; // Standard pong winning score
        
        if (score.left >= winningScore || score.right >= winningScore) {
            const winner = score.left >= winningScore ? this.player1Name : this.player2Name;
            this.handleMatchComplete(winner, { player1: score.left, player2: score.right });
        }
    }

    private async handleMatchComplete(winner: string, score: {player1: number, player2: number}): Promise<void> {
        console.log(`🏆 Match complete: ${winner} wins with score ${score.player1} - ${score.player2}`);

        // Update game session with final results
        if (this.gameSession && this.match) {
            try {
                const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
                const winnerId = winner === this.player1Name ? this.match.player1_id : this.match.player2_id;
                
                await remoteTournamentService.updateGameSession(this.gameSession.id, {
                    player1_score: score.player1,
                    player2_score: score.player2,
                    winner_id: winnerId,
                    status: 'finished',
                    finished_at: new Date().toISOString(),
                    game_duration: Date.now() - new Date(this.gameSession.started_at || this.gameSession.created_at).getTime()
                });
                
                console.log('✅ Match results saved to backend');
            } catch (error) {
                console.warn('⚠️ Failed to update game session with match result:', error);
            }
        }

        this.showMatchCompleteOverlay(winner, score);
        showNotification(`${winner} wins the match!`, 'success');
    }

    private showMatchCompleteOverlay(winner: string, score: {player1: number, player2: number}): void {
        const overlay = document.getElementById('matchCompleteOverlay');
        const winnerDisplay = document.getElementById('winnerDisplay');
        const finalScore = document.getElementById('finalScore');
        const matchDetails = document.getElementById('matchDetails');
        
        if (overlay && winnerDisplay && finalScore && matchDetails) {
            winnerDisplay.textContent = `${winner} Wins!`;
            finalScore.textContent = `Final Score: ${score.player1} - ${score.player2}`;
            matchDetails.textContent = `${this.player1Name} vs ${this.player2Name}`;
            overlay.style.display = 'flex';
        }
    }

    private checkWebGLSupport(): boolean {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (e) {
            return false;
        }
    }

    private showGameState(): void {
        const loading = document.getElementById('gameLoading');
        const canvas = document.getElementById('gameCanvas');
        const error = document.getElementById('gameError');
        
        if (loading) loading.style.display = 'none';
        if (canvas) {
            canvas.style.display = 'block';
            canvas.offsetHeight;
        }
        if (error) error.style.display = 'none';
    }

    private showError(message: string): void {
        const loading = document.getElementById('gameLoading');
        const canvas = document.getElementById('gameCanvas');
        const error = document.getElementById('gameError');
        const errorMessage = document.getElementById('errorMessage');
        
        if (loading) loading.style.display = 'none';
        if (canvas) canvas.style.display = 'none';
        if (error) error.style.display = 'flex';
        if (errorMessage) errorMessage.textContent = message;
        
        showError(`Tournament match failed: ${message}`);
    }


    private handleBackClick(): void {
        if (this.isGameInitialized && this.gameManager && !this.isSpectator) {
            const confirmed = confirm('Are you sure you want to leave the tournament match? This will forfeit the game.');
            if (!confirmed) return;
        }
        
        // Navigate back to tournament bracket
        const event = new CustomEvent('navigate', {
            detail: { path: `/game/tournament/remote/bracket/${this.tournamentId}` }
        });
        window.dispatchEvent(event);
    }

    private handleFullscreenClick(): void {
        const gameContainer = document.getElementById('gameContainer');
        if (!gameContainer) return;
        
        try {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                gameContainer.requestFullscreen();
            }
        } catch (error) {
            console.warn('Fullscreen not supported:', error);
            showNotification('Fullscreen not supported in this browser', 'error');
        }
    }

    private handleFullscreenChange(): void {
        setTimeout(() => {
            if (this.gameManager && (this.gameManager as any)?.renderEngine?.engine) {
                (this.gameManager as any).renderEngine.engine.resize();
            }
        }, 200);
    }

    private handleWindowResize(): void {
        if (this.gameManager && (this.gameManager as any)?.renderEngine?.engine) {
            (this.gameManager as any).renderEngine.engine.resize();
        }
    }




    private handleContinueTournament(): void {
        // Navigate back to tournament bracket to continue
        const event = new CustomEvent('navigate', {
            detail: { path: `/game/tournament/remote/bracket/${this.tournamentId}` }
        });
        window.dispatchEvent(event);
    }

    private handleRetry(): void {
        console.log('🔄 Retrying tournament match initialization...');
        if (this.gameManager) {
            this.gameManager.dispose();
            this.gameManager = null;
        }
        this.isGameInitialized = false;
        setTimeout(() => {
            this.initializeMatch();
        }, 500);
    }

    private async loadMatchData(): Promise<void> {
        try {
            // First, we need to find which tournament this match belongs to
            // We'll need to get tournament matches and find our match
            const tournaments = await remoteTournamentService.getTournaments('active', 50);
            
            let foundMatch: TournamentMatch | null = null;
            let foundTournament: Tournament | null = null;
            
            for (const tournament of tournaments) {
                try {
                    const matchesData = await remoteTournamentService.getTournamentMatches(tournament.id);
                    const match = matchesData.matches.find(m => m.id === this.matchId);
                    if (match) {
                        foundMatch = match;
                        foundTournament = tournament;
                        break;
                    }
                } catch (error) {
                    // Continue to next tournament if this one fails
                    continue;
                }
            }
            
            if (!foundMatch || !foundTournament) {
                throw new Error('Match not found in any tournament');
            }
            
            this.match = foundMatch;
            this.tournament = foundTournament;
            this.tournamentId = foundTournament.id;
            this.player1Name = foundMatch.player1_username || 'Player 1';
            this.player2Name = foundMatch.player2_username || 'Player 2';
            
            console.log(`✅ Loaded match data: ${this.player1Name} vs ${this.player2Name}`);
            this.updateMatchInfo();
            
        } catch (error) {
            console.error('Failed to load match data:', error);
            throw new Error(`Failed to load match: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async createGameSession(): Promise<void> {
        if (!this.match || this.isSpectator) return;
        
        try {
            // Check if game session already exists for this match
            if (this.match.game_session_id) {
                this.gameSession = await remoteTournamentService.getGameSession(this.match.game_session_id);
                console.log('✅ Using existing game session');
                return;
            }
            
            // Create new game session for tournament match
            const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
            const opponent = this.match.player1_id === currentUser.id ? 
                this.match.player2_id : this.match.player1_id;
                
            this.gameSession = await remoteTournamentService.createGameSession({
                player2_id: opponent,
                game_mode: 'tournament',
                tournament_id: this.tournamentId
            });
            
            console.log('✅ Created new game session');
            
        } catch (error) {
            console.error('Failed to create game session:', error);
            throw new Error(`Failed to create game session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}