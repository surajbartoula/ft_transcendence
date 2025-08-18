import { Page } from '../router/Router';
import { PongGameManager } from '../babylonjs/PongManager';
import { showNotification, showError } from '../utils/ui';

export class GamePage implements Page {
    public title = 'Pong Game';
    public requiresAuth = true;
    
    private gameManager: PongGameManager | null = null;
    private gameCanvas: HTMLCanvasElement | null = null;
    private isGameInitialized: boolean = false;
    private backButton: HTMLElement | null = null;
    private fullscreenButton: HTMLElement | null = null;
    private gameContainer: HTMLElement | null = null;
    // NEW: Add these properties for enhanced features
    private gameModeIndicator: HTMLElement | null = null;

    public render(): string {
        return `
            <div class="fixed inset-0 bg-slate-900 flex flex-col h-screen">
                <!-- Enhanced Game Header -->
                <div class="bg-slate-800 border-b border-slate-700 p-3 z-20 relative">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors z-30 relative">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Dashboard</span>
                            </button>
                            <div class="h-6 w-px bg-slate-600"></div>
                            <h1 class="text-lg font-bold text-white">Enhanced Pong Game</h1>
                            <!-- NEW: Game mode indicator -->
                            <div id="gameModeIndicator" class="px-2 py-1 bg-blue-600 text-white text-xs rounded hidden">
                                Local Mode
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

                    <!-- NEW: Game Status Bar -->
                    <div id="gameStatusBar" class="mt-2 flex items-center justify-between text-xs text-gray-400 hidden">
                        <div id="gameStatus">Ready to play</div>
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
                            <p class="text-white text-lg">Loading Enhanced Pong Game...</p>
                            <p class="text-gray-400 text-sm mt-2">Initializing 3D engine, AI system, and tournament features</p>
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
                                Unable to initialize the enhanced game engine. This may be due to WebGL compatibility issues.
                            </p>
                            <div class="space-y-2">
                                <button id="retryButton" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded mr-2">
                                    Retry
                                </button>
                                <button id="backToMenuButton" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded">
                                    Back to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- NEW: Quick Action Buttons (shown when game is loaded) -->
                    <div id="quickActions" class="absolute bottom-4 right-4 flex flex-col space-y-2 hidden z-10">
                        <button id="newLocalGameBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs">
                            New Local Game
                        </button>
                        <button id="newAIGameBtn" class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs">
                            Play vs AI
                        </button>
                        <button id="newTournamentBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-xs">
                            Tournament
                        </button>
                    </div>
                </div>

                <!-- Notifications Container -->
                <div id="notifications" class="fixed top-20 right-4 z-40 pointer-events-none"></div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        console.log('🎮 Initializing Enhanced Game Page...');
        
        this.bindElements();
        this.attachEventListeners();

        setTimeout(() => {
            this.initializeGame();
        }, 100);
    }

    public cleanup(): void {
        console.log('🎮 Cleaning up Enhanced Game Page...');
        
        if (this.gameManager) {
            try {
                this.gameManager.dispose();
                console.log('✅ Enhanced game manager disposed successfully');
            } catch (error) {
                console.warn('⚠️ Error disposing enhanced game manager:', error);
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

        // Enhanced event listeners
        const retryButton = document.getElementById('retryButton');
        if (retryButton) {
            retryButton.addEventListener('click', this.handleRetry.bind(this));
        }

        const backToMenuButton = document.getElementById('backToMenuButton');
        if (backToMenuButton) {
            backToMenuButton.addEventListener('click', this.handleBackClick.bind(this));
        }

        // AI difficulty is now always set to hard

        // NEW: Quick action buttons
        const newLocalGameBtn = document.getElementById('newLocalGameBtn');
        if (newLocalGameBtn) {
            newLocalGameBtn.addEventListener('click', () => this.startQuickGame('local'));
        }

        const newAIGameBtn = document.getElementById('newAIGameBtn');
        if (newAIGameBtn) {
            newAIGameBtn.addEventListener('click', () => this.startQuickGame('ai'));
        }

        const newTournamentBtn = document.getElementById('newTournamentBtn');
        if (newTournamentBtn) {
            newTournamentBtn.addEventListener('click', () => this.startQuickGame('tournament'));
        }

        // Standard event listeners
        document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        
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
    }

    // ENHANCED: Updated initialization method
    private async initializeGame(): Promise<void> {
        if (!this.gameCanvas) {
            console.error('❌ Game canvas not found');
            this.showError('Game canvas not available');
            return;
        }

        try {
            console.log('🎮 Starting enhanced game initialization...');
            
            if (!this.checkWebGLSupport()) {
                throw new Error('WebGL is not supported in this browser');
            }

            this.showGameState();
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log(`📐 Canvas ready - Display: ${this.gameCanvas.clientWidth}x${this.gameCanvas.clientHeight}`);
            if (this.gameCanvas.clientWidth === 0 || this.gameCanvas.clientHeight === 0) {
                throw new Error('Canvas has no display dimensions - check CSS and container setup');
            }

            console.log('🏓 Creating Enhanced PongGameManager...');
            this.gameManager = new PongGameManager(this.gameCanvas);
            
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (this.gameManager) {
                console.log('✅ Enhanced game initialized successfully!');
                this.isGameInitialized = true;

                // NEW: Initialize backend session
                await this.initializeBackendSession();

                // NEW: Set up game state monitoring
                this.setupGameStateMonitoring();

                // NEW: Show quick action buttons
                this.showQuickActions();

                if ((this.gameManager as any)?.renderEngine?.engine) {
                    (this.gameManager as any).renderEngine.engine.resize();
                    console.log('🔄 Forced resize after initialization');
                }

                showNotification('Enhanced Pong game loaded! Choose a game mode from the main menu.', 'success', 3000);
            } else {
                throw new Error('Enhanced game manager failed to initialize');
            }
        } catch (error) {
            console.error('❌ Failed to initialize enhanced game:', error);
            this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
        }
    }

    // NEW: Initialize backend session
    private async initializeBackendSession(): Promise<void> {
        if (!this.gameManager) return;

        try {
            // Initialize with local mode by default
            await this.gameManager.initializeGameSession('local');
            console.log('✅ Backend session initialized');
        } catch (error) {
            console.warn('⚠️ Backend session initialization failed:', error);
            // Continue without backend integration
        }
    }

    // NEW: Set up game state monitoring
    private setupGameStateMonitoring(): void {
        if (!this.gameManager) return;

        // Monitor game state changes
        setInterval(() => {
            this.updateGameStatusDisplay();
        }, 1000);
    }

    // NEW: Update game status display
    private updateGameStatusDisplay(): void {
        if (!this.gameManager) return;

        try {
            const gameMode = this.gameManager.getGameMode();
            const score = this.gameManager.getScore();
            
            // Update game mode indicator
            if (this.gameModeIndicator) {
                const modeText = gameMode.type === 'local' ? 'Local Mode' :
                               gameMode.type === 'ai' ? 'AI Mode' :
                               gameMode.type === 'tournament' ? 'Tournament' : 'Menu';
                this.gameModeIndicator.textContent = modeText;
                this.gameModeIndicator.classList.remove('hidden');
            }

            // AI difficulty is always hard (no UI selector needed)

            // Update score display
            const currentScore = document.getElementById('currentScore');
            if (currentScore) {
                currentScore.textContent = `Score: ${score.left} - ${score.right}`;
            }

            // Show game status bar when game is active
            const gameStatusBar = document.getElementById('gameStatusBar');
            if (gameStatusBar) {
                if (gameMode.type !== 'menu') {
                    gameStatusBar.classList.remove('hidden');
                } else {
                    gameStatusBar.classList.add('hidden');
                }
            }

        } catch (error) {
            console.warn('⚠️ Error updating game status display:', error);
        }
    }

    // NEW: Show quick action buttons
    private showQuickActions(): void {
        const quickActions = document.getElementById('quickActions');
        if (quickActions) {
            quickActions.classList.remove('hidden');
        }
    }

    // AI difficulty is now always hard

    // NEW: Start quick games
    private async startQuickGame(mode: 'local' | 'ai' | 'tournament'): Promise<void> {
        if (!this.gameManager) return;

        try {
            switch (mode) {
                case 'local':
                    await this.gameManager.startLocalGame();
                    showNotification('Local multiplayer game started!', 'success');
                    break;
                case 'ai':
                    await this.gameManager.startAIGame('Player');
                    showNotification(`AI game started on hard difficulty!`, 'success');
                    break;
                case 'tournament':
                    // For quick tournament, use default 4 players
                    const defaultPlayers = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
                    await this.gameManager.startTournament(defaultPlayers);
                    showNotification('Tournament started with 4 players!', 'success');
                    break;
            }
        } catch (error) {
            console.error('❌ Failed to start quick game:', error);
            showError(`Failed to start ${mode} game: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        
        showError(`Enhanced game initialization failed: ${message}`);
    }

    private handleBackClick(): void {
        if (this.isGameInitialized && this.gameManager) {
            const confirmed = confirm('Are you sure you want to leave the game? Your progress will be lost.');
            if (!confirmed) return;
        }
        const event = new CustomEvent('navigate', {
            detail: { path: '/dashboard' }
        });
        window.dispatchEvent(event);
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

    private handleRetry(): void {
        console.log('🔄 Retrying enhanced game initialization...');
        if (this.gameManager) {
            this.gameManager.dispose();
            this.gameManager = null;
        }
        this.isGameInitialized = false;
        setTimeout(() => {
            this.initializeGame();
        }, 500);
    }
}