import { Page } from '../router/Router';
import { PongGameManager } from '../babylonjs/PongManager';
import { TournamentManager } from '../babylonjs/TournamentManager';
import { showNotification, showError } from '../utils/ui';

export class SharedGamePage implements Page {
    public title = 'Pong Game';
    public requiresAuth = true;
    
    private gameManager: PongGameManager | null = null;
    private gameCanvas: HTMLCanvasElement | null = null;
    private isGameInitialized: boolean = false;
    private backButton: HTMLElement | null = null;
    private fullscreenButton: HTMLElement | null = null;
    private gameContainer: HTMLElement | null = null;
    private gameModeIndicator: HTMLElement | null = null;
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
                <!-- Game Header -->
                <div class="bg-slate-800 border-b border-slate-700 p-3 z-20 relative">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors z-30 relative">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Menu</span>
                            </button>
                            <div class="h-6 w-px bg-slate-600"></div>
                            <h1 class="text-lg font-bold text-white">Pong Game</h1>
                            <div id="gameModeIndicator" class="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                                Loading...
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

                    <!-- Game Status Bar -->
                    <div id="gameStatusBar" class="mt-2 flex items-center justify-between text-xs text-gray-400">
                        <div class="flex items-center space-x-4">
                            <div id="gameStatus">Initializing...</div>
                            <div id="playerNames" class="hidden">
                                <span id="player1Name" class="text-blue-400"></span> vs <span id="player2Name" class="text-orange-400"></span>
                            </div>
                        </div>
                        <div id="gameStats" class="flex space-x-4">
                            <span id="currentScore">Score: 0 - 0</span>
                            <span id="gameTime">Time: 0:00</span>
                        </div>
                    </div>
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

        const notificationsContainer = document.getElementById('notifications');
        if (notificationsContainer) {
            notificationsContainer.innerHTML = '';
        }
        
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(console.warn);
        }
        
        this.isGameInitialized = false;
        this.gameCanvas = null;
        this.backButton = null;
        this.fullscreenButton = null;
        this.gameContainer = null;
        this.gameModeIndicator = null;
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
        this.backButton = document.getElementById('backButton');
        this.fullscreenButton = document.getElementById('fullscreenButton');
        this.gameContainer = document.getElementById('gameContainer');
        this.gameModeIndicator = document.getElementById('gameModeIndicator');
    }

    private attachEventListeners(): void {
        if (this.backButton) {
            this.backButton.addEventListener('click', this.handleBackClick.bind(this));
        }
        if (this.fullscreenButton) {
            this.fullscreenButton.addEventListener('click', this.handleFullscreenClick.bind(this));
        }

        // Error handling buttons
        const retryButton = document.getElementById('retryButton');
        if (retryButton) {
            retryButton.addEventListener('click', this.handleRetry.bind(this));
        }

        const backToMenuButton = document.getElementById('backToMenuButton');
        if (backToMenuButton) {
            backToMenuButton.addEventListener('click', this.handleBackClick.bind(this));
        }

        // Pause overlay buttons

        // Game over buttons
        const playAgainButton = document.getElementById('playAgainButton');
        if (playAgainButton) {
            playAgainButton.addEventListener('click', this.handlePlayAgain.bind(this));
        }

        const backToMenuFromGameOver = document.getElementById('backToMenuFromGameOver');
        if (backToMenuFromGameOver) {
            backToMenuFromGameOver.addEventListener('click', this.handleBackClick.bind(this));
        }
        
        // Tournament completion handled by GameStateManager

        // System events
        document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        
        // Keyboard events for pause
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        if (this.gameCanvas) {
            this.gameCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
        }
    }

    private removeEventListeners(): void {
        if (this.backButton) {
            this.backButton.removeEventListener('click', this.handleBackClick);
        }
        if (this.fullscreenButton) {
            this.fullscreenButton.removeEventListener('click', this.handleFullscreenClick);
        }
        document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
        window.removeEventListener('resize', this.handleWindowResize);
        document.removeEventListener('keydown', this.handleKeyDown);
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

            this.updateLoadingMessage('Initializing 3D engine...');
            this.showGameState();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log(`📐 Canvas ready - Display: ${this.gameCanvas.clientWidth}x${this.gameCanvas.clientHeight}`);
            if (this.gameCanvas.clientWidth === 0 || this.gameCanvas.clientHeight === 0) {
                throw new Error('Canvas has no display dimensions - check CSS and container setup');
            }

            this.updateLoadingMessage('Creating game manager...');
            console.log('🏓 Creating PongGameManager...');
            this.gameManager = new PongGameManager(this.gameCanvas);
            
            await new Promise(resolve => setTimeout(resolve, 1500));

            if (this.gameManager) {
                console.log('✅ Game initialized successfully!');
                this.isGameInitialized = true;

                this.updateLoadingMessage('Starting game session...');
                await this.initializeBackendSession();
                await this.startGameBasedOnMode();
                this.setupGameStateMonitoring();
                this.updateGameInfo();

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

    private getGameModeDisplayName(): string {
        switch (this.gameMode) {
            case 'ai': return 'AI';
            case 'local': return 'Local Multiplayer';
            default: return 'Game';
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
                    const tournament = tournamentManager.getTournament(this.tournamentId!);
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
                    await this.gameManager.startLocalGame(this.player1Name, this.player2Name);
                    break;
                case 'ai':
                    await this.gameManager.startAIGame(this.player1Name);
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
                    const gameMode = gameStateManager.getGameMode();
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
                        if (score.left >= 11 || score.right >= 11) {
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
            const score = this.gameManager.getScore();
            const winningScore = 11; // Standard pong winning score
            
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

        try {
            const gameMode = this.gameManager.getGameMode();
            const score = this.gameManager.getScore();
            
            // Update game mode indicator
            if (this.gameModeIndicator) {
                this.gameModeIndicator.textContent = this.getGameModeDisplayName();
                this.gameModeIndicator.classList.remove('hidden');
            }

            // Update score display
            const currentScore = document.getElementById('currentScore');
            if (currentScore) {
                currentScore.textContent = `Score: ${score.left} - ${score.right}`;
            }

            // Update game status
            const gameStatus = document.getElementById('gameStatus');
            if (gameStatus) {
                gameStatus.textContent = gameMode.type !== 'menu' ? 'Playing' : 'Ready';
            }

        } catch (error) {
            console.warn('⚠️ Error updating game status display:', error);
        }
    }

    private updateGameInfo(): void {
        // Update player names display
        const player1Element = document.getElementById('player1Name');
        const player2Element = document.getElementById('player2Name');
        const playerNamesContainer = document.getElementById('playerNames');
        
        if (player1Element && player2Element && playerNamesContainer) {
            player1Element.textContent = this.player1Name;
            player2Element.textContent = this.player2Name;
            playerNamesContainer.classList.remove('hidden');
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
            console.log(`📐 Canvas shown - Display: ${canvas.clientWidth}x${canvas.clientHeight}`);
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
        
        showError(`Game initialization failed: ${message}`);
    }


    private handleBackClick(): void {
        if (this.isGameInitialized && this.gameManager) {
            const confirmed = confirm('Are you sure you want to leave the game? Your progress will be lost.');
            if (!confirmed) return;
        }
        
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

    private handleFullscreenClick(): void {
        if (!this.gameContainer) return;
        try {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                this.gameContainer.requestFullscreen();
            }
        } catch (error) {
            console.warn('Fullscreen not supported:', error);
            showNotification('Fullscreen not supported in this browser', 'error');
        }
    }

    private handleFullscreenChange(): void {
        const isFullscreen = !!document.fullscreenElement;
        console.log('Fullscreen state:', isFullscreen);
        
        setTimeout(() => {
            if (this.gameCanvas) {
                console.log(`📐 Canvas dimensions after fullscreen change: ${this.gameCanvas.clientWidth}x${this.gameCanvas.clientHeight}`);
            }
            if (this.gameManager && (this.gameManager as any)?.renderEngine?.engine) {
                (this.gameManager as any).renderEngine.engine.resize();
                console.log('🔄 Babylon.js engine resized after fullscreen change');
            }
        }, 200);
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

    private handleKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.handleBackClick();
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