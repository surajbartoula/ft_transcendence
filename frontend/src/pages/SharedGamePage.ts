import { Page } from '../router/Router';
import { PongGameManager } from '../babylonjs/PongManager';
import { TournamentManager } from '../babylonjs/TournamentManager';
import { showError } from '../utils/ui';

export class SharedGamePage implements Page {
    public title = 'Pong Game';
    public requiresAuth = true;
    
    private gameManager: PongGameManager | null = null;
    private gameCanvas: HTMLCanvasElement | null = null;
    private isGameInitialized: boolean = false;
    private gameMode: 'local' | 'ai' | 'remote' = 'local';
    private player1Name: string = 'Player 1';
    private player2Name: string = 'Player 2';
    private hasShownLoading: boolean = false;
    
    // Tournament support
    private tournamentId: string | null = null;
    private matchId: string | null = null;
    private tournamentManager: TournamentManager | null = null;
    private isGameCompleted: boolean = false;
    private lastScore: {left: number, right: number} | null = null;

    public render(): string {
        return `
            <div class="fixed inset-0 bg-slate-900 flex flex-col h-screen">
                <!-- Small Info Message -->
                <div class="absolute top-4 left-4 z-30 bg-black bg-opacity-50 text-white text-sm px-3 py-2 rounded">
                    Press <span class="text-green-400 font-semibold">Space</span> for menu
                </div>
                

                <!-- Game Container -->
                <div id="gameContainer" class="flex-1 relative bg-black overflow-hidden">
                    <!-- Loading State -->
                    <div id="gameLoading" class="absolute inset-0 flex items-center justify-center bg-slate-900">
                        <div class="text-center">
                            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                            <p class="text-white text-lg">Loading Game...</p>
                            <p class="text-gray-400 text-sm mt-2" id="loadingMessage">Initializing 3D engine and game systems</p>
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
                            <h2 class="text-white text-xl font-bold mb-2">Game Failed to Load</h2>
                            <p class="text-gray-400 mb-4" id="errorMessage">
                                Unable to initialize the game engine. This may be due to WebGL compatibility issues.
                            </p>
                            <div class="space-y-2">
                                <button id="retryButton" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded mr-2">
                                    Retry
                                </button>
                                <button id="backToMenuButton" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded">
                                    Back to Menu
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Game Over Overlay -->
                    <div id="gameOverOverlay" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-20" style="display: none;">
                        <div class="text-center max-w-md mx-auto p-6">
                            <h2 class="text-white text-3xl font-bold mb-4">Game Over!</h2>
                            <div id="winnerDisplay" class="text-2xl font-semibold mb-4"></div>
                            <div id="finalScore" class="text-lg text-gray-300 mb-6"></div>
                            <div class="space-y-2">
                                <button id="playAgainButton" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded mr-2">
                                    Play Again
                                </button>
                                <button id="backToMenuFromGameOver" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded">
                                    Back to Menu
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tournament Complete Overlay - Removed, GameStateManager handles navigation -->
                </div>

                <!-- Notifications Container -->
                <div id="notifications" class="fixed top-20 right-4 z-40 pointer-events-none"></div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        console.log('🎮 Initializing Shared Game Page...');
        
        this.parseGameMode();
        this.bindElements();
        this.attachEventListeners();

        setTimeout(() => {
            this.initializeGame();
        }, 100);
    }

    public cleanup(): void {
        console.log('🎮 Cleaning up Shared Game Page...');
        
        // Tournament cleanup handled by GameStateManager
        
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

        // Clean up any lingering countdown UI elements using multiple selectors
        const countdownElements = document.querySelectorAll('#countdownOverlay, [data-game-element="countdown"], .game-countdown-overlay');
        countdownElements.forEach(el => {
            console.log('🧹 SharedGamePage: Removing countdown element:', el);
            el.remove();
        });

        const notificationsContainer = document.getElementById('notifications');
        if (notificationsContainer) {
            notificationsContainer.innerHTML = '';
        }
        
        
        this.isGameInitialized = false;
        this.gameCanvas = null;
        this.hasShownLoading = false;
    }

    private parseGameMode(): void {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode') as 'local' | 'ai' | 'remote';
        const player1 = urlParams.get('player1') || 'Player 1';
        const player2 = urlParams.get('player2') || (mode === 'ai' ? 'AI' : mode === 'remote' ? 'Finding opponent...' : 'Player 2');

        // Parse tournament parameters
        this.tournamentId = urlParams.get('tournamentId');
        this.matchId = urlParams.get('matchId');
        
        if (this.tournamentId) {
            this.tournamentManager = TournamentManager.getInstance();
            console.log(`🏆 Tournament match detected - ID: ${this.tournamentId}, Match: ${this.matchId}`);
        }

        this.gameMode = mode || 'local';
        this.player1Name = player1;
        this.player2Name = player2;

        console.log(`🎮 Game mode: ${this.gameMode}, ${player1} vs ${player2}`);
    }

    private bindElements(): void {
        this.gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    }

    private attachEventListeners(): void {

        // Error handling buttons
        const retryButton = document.getElementById('retryButton');
        if (retryButton) {
            retryButton.addEventListener('click', this.handleRetry.bind(this));
        }

        const backToMenuButton = document.getElementById('backToMenuButton');
        if (backToMenuButton) {
            backToMenuButton.addEventListener('click', this.handleBackClick.bind(this));
        }

        // Game over buttons
        const playAgainButton = document.getElementById('playAgainButton');
        if (playAgainButton) {
            playAgainButton.addEventListener('click', this.handlePlayAgain.bind(this));
        }

        const backToMenuFromGameOver = document.getElementById('backToMenuFromGameOver');
        if (backToMenuFromGameOver) {
            backToMenuFromGameOver.addEventListener('click', this.handleBackClick.bind(this));
        }

        // System events
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        
        if (this.gameCanvas) {
            this.gameCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
        }
    }

    private removeEventListeners(): void {
        window.removeEventListener('resize', this.handleWindowResize);
    }

    private async initializeGame(): Promise<void> {
        if (!this.gameCanvas) {
            console.error('❌ Game canvas not found');
            this.showError('Game canvas not available');
            return;
        }

        try {
            console.log('🎮 Starting game initialization...');
            
            if (!this.checkWebGLSupport()) {
                throw new Error('WebGL is not supported in this browser');
            }

            this.updateLoadingMessage('Creating game manager...');
            console.log('🏓 Creating PongGameManager...');
            this.gameManager = new PongGameManager(this.gameCanvas);
            
            if (this.gameManager) {
                console.log('✅ Game manager created successfully!');
                this.isGameInitialized = true;

                // Set up state change listener BEFORE starting game
                this.gameManager.onStateChange((stateName: string) => {
                    console.log(`📺 State changed to: ${stateName}, updating canvas visibility`);
                    this.showGameStateIfReady();
                });

                this.updateLoadingMessage('Starting game session...');
                await this.initializeBackendSession();
                
                this.updateLoadingMessage('Initializing game mode...');
                
                // Start game mode - this will set the initial state
                await this.startGameBasedOnMode();
                
                this.setupGameStateMonitoring();
                this.updateGameInfo();

                // Only show canvas after a delay to ensure state is properly established
                setTimeout(() => {
                    console.log('⏰ Checking if canvas should be shown after delay');
                    this.showGameStateIfReady();
                }, 300); // Increased delay to ensure state is set

                if ((this.gameManager as any)?.renderEngine?.engine) {
                    (this.gameManager as any).renderEngine.engine.resize();
                    console.log('🔄 Forced resize after initialization');
                }
            } else {
                throw new Error('Game manager failed to initialize');
            }
        } catch (error) {
            console.error('❌ Failed to initialize game:', error);
            this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
        }
    }

    private updateLoadingMessage(message: string): void {
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
    }

    private async startGameBasedOnMode(): Promise<void> {
        if (!this.gameManager) return;

        if (this.tournamentId && this.matchId) {
            // Tournament match - set up proper tournament mode
            
            // Set tournament game mode in PongManager's GameStateManager
            const gameStateManager = (this.gameManager as any).gameState;
            if (gameStateManager) {
                const tournamentManager = gameStateManager.getTournamentManager();
                
                if (tournamentManager) {
                    tournamentManager.getTournament(this.tournamentId!);
                }
                
                gameStateManager.setGameMode({
                    type: 'tournament',
                    player1Name: this.player1Name,
                    player2Name: this.player2Name,
                    tournamentId: this.tournamentId
                });
                
                // Start tournament match with proper match data
                await gameStateManager.setState('playing', {
                    player1: { name: this.player1Name },
                    player2: { name: this.player2Name },
                    matchId: this.matchId
                });
            } else {
                console.warn('⚠️ GameStateManager not available, falling back to local game');
                await this.gameManager.startLocalGame(this.player1Name, this.player2Name);
            }
        } else {
            // Regular game modes
            switch (this.gameMode) {
                case 'local':
                    // Only pass player names if they were explicitly provided in URL and not defaults
                    const hasCustomNames = this.player1Name !== 'Player 1' || this.player2Name !== 'Player 2';
                    if (hasCustomNames) {
                        console.log('🎮 Starting local game with provided names');
                        await this.gameManager.startLocalGame(this.player1Name, this.player2Name);
                    } else {
                        // Go through setup to get player names
                        console.log('🎮 Starting local game with setup state');
                        await this.gameManager.startLocalGame();
                    }
                    break;
                case 'ai':
                    // Only pass player name if it was explicitly provided in URL and not default
                    const hasCustomPlayerName = this.player1Name !== 'Player 1';
                    if (hasCustomPlayerName) {
                        console.log('🎮 Starting AI game with provided name');
                        await this.gameManager.startAIGame(this.player1Name);
                    } else {
                        // Go through setup to get player name
                        console.log('🎮 Starting AI game with setup state');
                        await this.gameManager.startAIGame();
                    }
                    break;
            }
        }
    }

    private async initializeBackendSession(): Promise<void> {
        if (!this.gameManager) return;

        try {
            await this.gameManager.initializeGameSession(this.gameMode);
            console.log('✅ Backend session initialized');
        } catch (error) {
            console.warn('⚠️ Backend session initialization failed:', error);
        }
    }

    private setupGameStateMonitoring(): void {
        if (!this.gameManager) return;

        setInterval(() => {
            this.updateGameStatusDisplay();
            
            // Debug tournament state
            if (this.tournamentId && this.gameManager) {
                const gameStateManager = (this.gameManager as any).gameState;
                if (gameStateManager) {
                    gameStateManager.getGameMode();
                    const tournamentManager = gameStateManager.getTournamentManager();
                    const tournament = tournamentManager?.getTournament(this.tournamentId);
                    
                    if (tournament) {
                        const score = this.gameManager.getScore();
                        
                        // Add detailed score debugging
                        if (!this.lastScore || this.lastScore.left !== score.left || this.lastScore.right !== score.right) {
                            this.lastScore = {left: score.left, right: score.right};
                            
                            // Debug score manager state whenever score changes
                            const gameStateManager = (this.gameManager as any).gameState;
                            if (gameStateManager && gameStateManager.systems && gameStateManager.systems.scoreManager) {
                                const scoreManager = gameStateManager.systems.scoreManager;
                                const internalScore = scoreManager.getScore();
                                
                                // Check if there's a mismatch
                                if (internalScore.left !== score.left || internalScore.right !== score.right) {
                                }
                            }
                        }
                        
                        // Reduce logging frequency - only log every 10th check
                        if (Math.random() < 0.1) {
                                                    }
                        
                        // Check if game should have ended
                        if (score.left >= 7 || score.right >= 7) {
                            if (!this.isGameCompleted) {
                                                            }
                        }
                    }
                }
            } else if (!this.tournamentId) {
                this.checkForGameCompletion();
            }
        }, 2000); // Check every 2 seconds for better debugging
        
        // GameStateManager handles tournament progression automatically
        // No need for custom tournament monitoring when using GameStateManager
    }
    
    private checkForGameCompletion(): void {
        if (!this.gameManager || this.isGameCompleted) return;
        
        try {
            // Check if GameStateManager is handling game over states
            const gameStateManager = (this.gameManager as any).gameState;
            if (gameStateManager) {
                // GameStateManager will handle game over state, don't duplicate
                return;
            }
            
            const score = this.gameManager.getScore();
            const winningScore = 7; // Standard pong winning score
            
            if (score.left >= winningScore || score.right >= winningScore) {
                this.isGameCompleted = true;
                const winner = score.left >= winningScore ? this.player1Name : this.player2Name;
                const finalScore = { player1: score.left, player2: score.right };
                
                console.log(`🏆 Game completed: ${winner} wins ${finalScore.player1} - ${finalScore.player2}`);
                this.showGameOver(winner, finalScore);
            }
        } catch (error) {
            console.warn('⚠️ Error checking game completion:', error);
        }
    }

    private updateGameStatusDisplay(): void {
        if (!this.gameManager) return;
        // Status display removed - game has its own in-game menu
    }

    private updateGameInfo(): void {
        // Game info now handled by in-game menu system
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


    private showGameStateIfReady(): void {
        // Check if the game is in a state where the canvas should be visible
        if (this.gameManager) {
            const currentState = this.gameManager.getCurrentStateName();
            console.log(`🎮 Current game state: ${currentState}, mode: ${this.gameMode}, hasShownLoading: ${this.hasShownLoading}`);
            
            const loading = document.getElementById('gameLoading');
            const canvas = document.getElementById('gameCanvas');
            const error = document.getElementById('gameError');
            
            if (currentState) {
                // Show loading only once for local multiplayer setup, then hide permanently
                if (!this.hasShownLoading && this.gameMode === 'local' && currentState === 'gameSetup') {
                    // First time local multiplayer setup - keep loading visible
                    this.hasShownLoading = true;
                    console.log(`⏳ First time local multiplayer setup - showing loading`);
                    return;
                }
                
                // For all other cases: hide loading and show canvas
                if (loading) {
                    loading.style.display = 'none';
                    console.log(`🎯 Loading hidden permanently for ${this.gameMode} ${currentState}`);
                }
                
                if (canvas) {
                    canvas.style.display = 'block';
                    console.log(`📐 Canvas shown for ${this.gameMode} ${currentState}`);
                    
                    // Ensure canvas dimensions are correct
                    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
                        canvas.style.width = '100%';
                        canvas.style.height = '100%';
                    }
                }
                
                if (error) error.style.display = 'none';
                
                if ((this.gameManager as any)?.renderEngine?.engine) {
                    (this.gameManager as any).renderEngine.engine.resize();
                    console.log('🔄 Engine resized');
                }
            }
        } else {
            console.log('⚠️ Game manager not available yet');
        }
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
        
        showError(`Game initialization failed: ${message}`);
    }


    private handleBackClick(): void {
        console.log('🔙 Back button clicked - starting cleanup...');
        
        // Explicitly call cleanup to ensure game resources are disposed
        this.cleanup();
        
        if (this.tournamentId) {
            // Navigate back to tournament bracket
            console.log('🏆 Returning to tournament bracket from tournament match');
            this.returnToTournamentBracket();
        } else {
            console.log('🎮 Returning to game menu from regular match');
            const event = new CustomEvent('navigate', {
                detail: { path: '/game' }
            });
            window.dispatchEvent(event);
        }
    }


    private handleWindowResize(): void {
        console.log('🔄 Window resize detected');
        if (this.gameCanvas) {
            console.log(`📐 Canvas dimensions: ${this.gameCanvas.clientWidth}x${this.gameCanvas.clientHeight}`);
        }
        if (this.gameManager && (this.gameManager as any)?.renderEngine?.engine) {
            (this.gameManager as any).renderEngine.engine.resize();
            console.log('🔄 Babylon.js engine resized');
        }
    }




    private handlePlayAgain(): void {
        if (this.gameManager) {
            this.startGameBasedOnMode();
            const gameOverOverlay = document.getElementById('gameOverOverlay');
            if (gameOverOverlay) {
                gameOverOverlay.style.display = 'none';
            }
        }
    }

    private handleRetry(): void {
        console.log('🔄 Retrying game initialization...');
        if (this.gameManager) {
            this.gameManager.dispose();
            this.gameManager = null;
        }
        this.isGameInitialized = false;
        setTimeout(() => {
            this.initializeGame();
        }, 500);
    }
    
    // Tournament state monitoring removed - GameStateManager handles everything
    
    private showGameOver(winner: string, score: {player1: number, player2: number}): void {
        const overlay = document.getElementById('gameOverOverlay');
        const winnerDisplay = document.getElementById('winnerDisplay');
        const finalScore = document.getElementById('finalScore');
        
        if (overlay && winnerDisplay && finalScore) {
            winnerDisplay.textContent = `${winner} wins!`;
            finalScore.textContent = `Final Score: ${score.player1} - ${score.player2}`;
            overlay.style.display = 'flex';
        }
    }
    
    // Tournament completion UI removed - GameStateManager handles navigation
    
    private returnToTournamentBracket(): void {
        if (!this.tournamentId) {
            console.warn('⚠️ No tournament ID available for navigation');
            this.navigateToTournamentSetup();
            return;
        }
        
        console.log('🏆 Returning to tournament bracket with updated state');
        
        // Navigate back to tournament bracket with updated tournament state
        const tournament = this.tournamentManager?.getTournament(this.tournamentId);
        if (tournament) {
            const playersParam = encodeURIComponent(JSON.stringify(tournament.players.map(p => p.name)));
            const navigationPath = `/game/tournament/bracket?players=${playersParam}&name=${encodeURIComponent('Tournament')}`;
            
            console.log('🏆 Navigating to:', navigationPath);
            const event = new CustomEvent('navigate', {
                detail: { path: navigationPath }
            });
            window.dispatchEvent(event);
        } else {
            console.error('❌ Tournament not found, returning to setup');
            this.navigateToTournamentSetup();
        }
    }
    
    private navigateToTournamentSetup(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: '/game/tournament/setup' }
        });
        window.dispatchEvent(event);
    }
}