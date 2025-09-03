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
        this.parseGameMode();
        this.bindElements();
        this.attachEventListeners();

        setTimeout(() => {
            this.initializeGame();
        }, 100);
    }

    public cleanup(): void {
        
        // Tournament cleanup handled by GameStateManager
        
        if (this.gameManager) {
            try {
                this.gameManager.dispose();
            } catch (error) {
                console.warn('Error disposing game manager:', error);
            }
            this.gameManager = null;
        }
        
        this.removeEventListeners();

        // Clean up any lingering countdown UI elements using multiple selectors
        const countdownElements = document.querySelectorAll('#countdownOverlay, [data-game-element="countdown"], .game-countdown-overlay');
        countdownElements.forEach(el => {
            try {
                el.remove();
            } catch (error) {
                console.warn('Error removing countdown element:', error);
            }
        });

        const notificationsContainer = document.getElementById('notifications');
        if (notificationsContainer) {
            notificationsContainer.innerHTML = '';
        }
        
        this.isGameInitialized = false;
        this.gameCanvas = null;
        
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
        }

        this.gameMode = mode || 'local';
        this.player1Name = player1;
        this.player2Name = player2;

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
        // Remove system events
        window.removeEventListener('resize', this.handleWindowResize);
        
        // Remove button event listeners
        const retryButton = document.getElementById('retryButton');
        if (retryButton) {
            retryButton.removeEventListener('click', this.handleRetry.bind(this));
        }

        const backToMenuButton = document.getElementById('backToMenuButton');
        if (backToMenuButton) {
            backToMenuButton.removeEventListener('click', this.handleBackClick.bind(this));
        }

        const playAgainButton = document.getElementById('playAgainButton');
        if (playAgainButton) {
            playAgainButton.removeEventListener('click', this.handlePlayAgain.bind(this));
        }

        const backToMenuFromGameOver = document.getElementById('backToMenuFromGameOver');
        if (backToMenuFromGameOver) {
            backToMenuFromGameOver.removeEventListener('click', this.handleBackClick.bind(this));
        }

        // Remove canvas event listeners
        if (this.gameCanvas) {
            this.gameCanvas.removeEventListener('contextmenu', (e) => e.preventDefault());
        }
    }

    private async initializeGame(): Promise<void> {
        if (!this.gameCanvas) {
            console.error('Game canvas not found');
            this.showError('Game canvas not available');
            return;
        }

        try {
            if (!this.checkWebGLSupport()) {
                throw new Error('WebGL is not supported in this browser');
            }

            this.gameManager = new PongGameManager(this.gameCanvas);
            
            if (this.gameManager) {
                this.isGameInitialized = true;

                // Set up state change listener BEFORE starting game
                this.gameManager.onStateChange((_stateName: string) => {
                    this.showGameStateIfReady();
                });

                await this.initializeBackendSession();
                
                // For tournaments, show canvas immediately so users can see the game board during countdown
                if (this.tournamentId && this.matchId) {
                    const canvas = document.getElementById('gameCanvas');
                    if (canvas) {
                        canvas.style.display = 'block';
                        
                        // Ensure canvas dimensions are correct
                        if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
                            canvas.style.width = '100%';
                            canvas.style.height = '100%';
                        }
                        
                        // Force engine resize to fix blurry canvas
                        if ((this.gameManager as any)?.renderEngine?.engine) {
                            (this.gameManager as any).renderEngine.engine.resize();
                        }
                    }
                }
                
                // Start game mode - this will set the initial state
                await this.startGameBasedOnMode();
                
                this.setupGameStateMonitoring();

                // Only show canvas after a delay to ensure state is properly established
                setTimeout(() => {
                    this.showGameStateIfReady();
                }, 300); // Increased delay to ensure state is set

                if ((this.gameManager as any)?.renderEngine?.engine) {
                    (this.gameManager as any).renderEngine.engine.resize();
                }
            } else {
                throw new Error('Game manager failed to initialize');
            }
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
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
                console.warn('GameStateManager not available, falling back to local game');
                await this.gameManager.startLocalGame(this.player1Name, this.player2Name);
            }
        } else {
            // Regular game modes
            switch (this.gameMode) {
                case 'local':
                    // Only pass player names if they were explicitly provided in URL and not defaults
                    const hasCustomNames = this.player1Name !== 'Player 1' || this.player2Name !== 'Player 2';
                    if (hasCustomNames) {
                        await this.gameManager.startLocalGame(this.player1Name, this.player2Name);
                    } else {
                        // Go through setup to get player names
                        await this.gameManager.startLocalGame();
                    }
                    break;
                case 'ai':
                    // Only pass player name if it was explicitly provided in URL and not default
                    const hasCustomPlayerName = this.player1Name !== 'Player 1';
                    if (hasCustomPlayerName) {
                        await this.gameManager.startAIGame(this.player1Name);
                    } else {
                        // Go through setup to get player name
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
        } catch (error) {
            console.warn('Backend session initialization failed:', error);
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
                this.showGameOver(winner, finalScore);
            }
        } catch (error) {
            console.warn('Error checking game completion:', error);
        }
    }

    private updateGameStatusDisplay(): void {
        if (!this.gameManager) return;
        // Status display removed - game has its own in-game menu
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
            
            const canvas = document.getElementById('gameCanvas');
            const error = document.getElementById('gameError');
            
            if (currentState) {
                if (canvas) {
                    canvas.style.display = 'block';
                    
                    // Ensure canvas dimensions are correct
                    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
                        canvas.style.width = '100%';
                        canvas.style.height = '100%';
                    }
                }
                
                if (error) error.style.display = 'none';
                
                if ((this.gameManager as any)?.renderEngine?.engine) {
                    (this.gameManager as any).renderEngine.engine.resize();
                }
            }
        }
    }

    private showError(message: string): void {
        const canvas = document.getElementById('gameCanvas');
        const error = document.getElementById('gameError');
        const errorMessage = document.getElementById('errorMessage');
        if (canvas) canvas.style.display = 'none';
        if (error) error.style.display = 'flex';
        if (errorMessage) errorMessage.textContent = message;
        
        showError(`Game initialization failed: ${message}`);
    }


    private handleBackClick(): void {
        // Explicitly call cleanup to ensure game resources are disposed
        this.cleanup();
        
        if (this.tournamentId) {
            // Navigate back to tournament bracket
            this.returnToTournamentBracket();
        } else {
            const event = new CustomEvent('navigate', {
                detail: { path: '/game' }
            });
            window.dispatchEvent(event);
        }
    }


    private handleWindowResize(): void {
        if (this.gameManager && (this.gameManager as any)?.renderEngine?.engine) {
            (this.gameManager as any).renderEngine.engine.resize();
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
            console.warn('No tournament ID available for navigation');
            this.navigateToTournamentSetup();
            return;
        }
        // Navigate back to tournament bracket with updated tournament state
        const tournament = this.tournamentManager?.getTournament(this.tournamentId);
        if (tournament) {
            const playersParam = encodeURIComponent(JSON.stringify(tournament.players.map(p => p.name)));
            const navigationPath = `/game/tournament/bracket?players=${playersParam}&name=${encodeURIComponent('Tournament')}`;
            const event = new CustomEvent('navigate', {
                detail: { path: navigationPath }
            });
            window.dispatchEvent(event);
        } else {
            console.error('Tournament not found, returning to setup');
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