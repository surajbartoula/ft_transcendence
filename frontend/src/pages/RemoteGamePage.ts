import { Page } from '../router/Router';
import { PongGameManager } from '../babylonjs/PongManager';
import { showNotification, showError } from '../utils/ui';
import gameSocket from '../utils/gameSocket';

export class RemoteGamePage implements Page {
    public title = 'Remote Match';
    public requiresAuth = true;
    
    private gameManager: PongGameManager | null = null;
    private gameCanvas: HTMLCanvasElement | null = null;
    private isGameInitialized: boolean = false;
    private isInitializing: boolean = false;
    private gameSessionId: string = '';
    private roomId: string = '';
    private isPlayer1: boolean = false;
    private initializationPromise: Promise<void> | null = null;
    private isDisposed: boolean = false;
    private player1Name: string = 'Player 1';
    private player2Name: string = 'Player 2';
    private currentUser: any = null;
    private opponentConnected: boolean = false;
    private opponentUserId: string | null = null;
    private opponentUsername: string | null = null;
    private keysPressed: Set<string> = new Set();
    private currentPaddleDirection: 'up' | 'down' | null = null;
    
    // Store bound event handler references for proper cleanup
    private boundHandlers = {
        gameState: this.handleGameState.bind(this),
        gameStarted: this.handleGameStarted.bind(this),
        gameEnded: this.handleGameEnded.bind(this),
        playerJoined: this.handlePlayerJoined.bind(this),
        playerLeft: this.handlePlayerLeft.bind(this),
        playerReady: this.handlePlayerReady.bind(this),
        gameUpdate: this.handleGameUpdate.bind(this),
        paddleUpdate: this.handlePaddleUpdate.bind(this),
        goalScored: this.handleGoalScored.bind(this),
        gamePaused: this.handleGamePaused.bind(this),
        audioEvent: this.handleAudioEvent.bind(this),
        gameChatMessage: this.handleChatMessage.bind(this),
        playerEmote: this.handlePlayerEmote.bind(this)
    };

    public render(): string {
        return `
            <div class="fixed inset-0 bg-black flex flex-col h-screen">
                <!-- Remote Game Header -->
                <div class="bg-slate-900/90 backdrop-blur-sm border-b border-cyan-500/30 p-3 z-20 relative tron-glow">
                    <style>
                        .tron-glow {
                            box-shadow: 0 0 10px rgba(0, 255, 255, 0.3), 0 0 20px rgba(0, 255, 255, 0.1);
                        }
                    </style>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors z-30 relative tron-glow">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Exit Game</span>
                            </button>
                            <div class="h-6 w-px bg-cyan-500/30"></div>
                            <h1 class="text-xl font-bold text-cyan-400">Remote Match</h1>
                        </div>
                        <div class="flex items-center space-x-6">
                            <!-- Player Status -->
                            <div class="flex items-center space-x-4">
								<div class="text-center">
									<div id="player2Name" class="text-white font-semibold">${this.player2Name}</div>
									<div id="player2Score" class="text-2xl font-bold text-cyan-400">0</div>
								</div>
								<div class="text-2xl text-cyan-300 font-bold">VS</div>
                                <div class="text-center">
                                    <div id="player1Name" class="text-white font-semibold">${this.player1Name}</div>
                                    <div id="player1Score" class="text-2xl font-bold text-cyan-400">0</div>
                                </div>
                            </div>
                            <!-- Connection Status -->
                            <div class="flex items-center space-x-2">
                                <div id="connectionStatus" class="flex items-center">
                                    <div class="w-2 h-2 bg-cyan-500 rounded-full mr-2"></div>
                                    <span class="text-sm text-cyan-400">Connecting...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Game Container -->
                <div id="gameContainer" class="flex-1 relative bg-black overflow-hidden">
                    <!-- Game Canvas -->
                    <canvas id="gameCanvas" class="w-full h-full block" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);"></canvas>
                    
                    <!-- Game Loading Overlay -->
                    <div id="gameLoading" class="absolute inset-0 bg-slate-900 bg-opacity-95 flex items-center justify-center z-10">
                        <div class="text-center">
                            <div class="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <h2 class="text-xl font-semibold text-white mb-2">Initializing Remote Match</h2>
                            <p id="loadingMessage" class="text-gray-400">Connecting to game server...</p>
                        </div>
                    </div>

                    <!-- Waiting for Opponent -->
                    <div id="waitingOverlay" class="absolute inset-0 bg-slate-900 bg-opacity-95 flex items-center justify-center z-10 hidden">
                        <div class="text-center">
                            <div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <h2 class="text-xl font-semibold text-white mb-2">Waiting for Opponent</h2>
                            <p class="text-gray-400">Your opponent will join shortly...</p>
                        </div>
                    </div>

                    <!-- Ready Status -->
                    <div id="readyOverlay" class="absolute inset-0 bg-slate-900 bg-opacity-95 flex items-center justify-center z-10 hidden">
                        <div class="text-center">
                            <h2 class="text-xl font-semibold text-white mb-4">Ready to Play?</h2>
                            <p class="text-gray-400 mb-6">Both players connected. Click ready when you're prepared!</p>
                            <button id="readyButton" class="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg transition-colors">
                                I'm Ready!
                            </button>
                            <div id="readyStatus" class="mt-4 text-sm text-gray-400">
                                Waiting for both players to be ready...
                            </div>
                        </div>
                    </div>

                    <!-- Game Over Overlay -->
                    <div id="gameOverOverlay" class="absolute inset-0 bg-slate-900 bg-opacity-95 flex items-center justify-center z-10 hidden">
                        <div class="text-center">
                            <div id="gameResult" class="mb-6">
                                <h2 id="resultTitle" class="text-3xl font-bold text-white mb-2">Game Over</h2>
                                <p id="resultMessage" class="text-xl text-gray-400">Thanks for playing!</p>
                            </div>
                            <div id="finalScore" class="mb-6 p-4 bg-slate-800 rounded-lg">
                                <div class="text-lg text-gray-300">Final Score</div>
                                <div class="text-2xl font-bold text-white">
                                    <span id="finalPlayer1Score">0</span> - <span id="finalPlayer2Score">0</span>
                                </div>
                            </div>
                            <div class="flex space-x-4">
                                <button id="playAgainButton" class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                                    Challenge Again
                                </button>
                                <button id="backToLobbyFromGameOver" class="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors">
                                    Back to Lobby
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Error Overlay -->
                    <div id="errorOverlay" class="absolute inset-0 bg-slate-900 bg-opacity-95 flex items-center justify-center z-20 hidden">
                        <div class="text-center max-w-md">
                            <div class="text-red-500 mb-4">
                                <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 13.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                </svg>
                            </div>
                            <h2 class="text-xl font-semibold text-white mb-2">Connection Error</h2>
                            <p id="errorMessage" class="text-gray-400 mb-6">Unable to connect to the game server</p>
                            <div class="flex space-x-4">
                                <button id="retryButton" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                                    Retry
                                </button>
                                <button id="backToLobbyFromError" class="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors">
                                    Back to Lobby
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Game Chat -->
                    <div id="gameChatContainer" class="absolute bottom-4 left-4 w-80 max-h-40 hidden z-15">
                        <div class="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                            <div class="bg-slate-700 px-3 py-2 flex items-center justify-between">
                                <span class="text-white text-sm font-medium">Game Chat</span>
                                <button id="toggleChatButton" class="text-gray-400 hover:text-white">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            </div>
                            <div id="chatMessages" class="h-24 overflow-y-auto p-2 text-sm"></div>
                            <div class="p-2 border-t border-slate-600">
                                <div class="flex space-x-2">
                                    <input id="chatInput" type="text" placeholder="Type a message..." class="flex-1 px-2 py-1 bg-slate-600 text-white text-xs rounded">
                                    <button id="sendChatButton" class="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded">Send</button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Notifications Container -->
                <div id="notifications" class="fixed top-20 right-4 z-40 pointer-events-none"></div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        if (this.isDisposed) {
            return;
        }
        
        this.currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
        
        this.parseGameParameters();
        this.bindElements();
        this.attachEventListeners();
        this.setupSocketEventListeners();

        // Check if we're still valid after async operations
        if (this.isDisposed) {
            return;
        }

        // Connect and authenticate socket
        const socketConnected = gameSocket.isConnected();
        
        if (!socketConnected) {
            gameSocket.connect();
            // Give it a moment to connect
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Check again after async wait
        if (this.isDisposed) {
            return;
        }
        try {
            await this.forceReauthentication();
        } catch (error) {
            console.error('Failed to authenticate:', error);
            // Try to initialize anyway to show error overlay
            if (!this.isDisposed) {
                this.initializeRemoteGame();
            }
            return;
        }

        if (!this.isDisposed) {
            this.initializeRemoteGame();
        }
    }

    public cleanup(): void {
        // Mark as disposed to prevent further operations
        this.isDisposed = true;
        
        // Don't cleanup if initialization is in progress unless we're being forced to
        if (this.isInitializing && this.initializationPromise) {
            console.warn('Cleanup called while initialization in progress - this may cause issues');
        }
        
        // Stop any ongoing paddle movement
        if (this.currentPaddleDirection !== null) {
            gameSocket.stopMovingPaddle();
            this.currentPaddleDirection = null;
        }
        this.keysPressed.clear();
        
        // Set flags to prevent any further operations
        this.isGameInitialized = false;
        this.isInitializing = false;
        this.initializationPromise = null;
        
        if (this.gameManager) {
            try {
                this.gameManager.dispose();
            } catch (error) {
                console.warn('Error disposing game manager:', error);
            }
            this.gameManager = null;
        }
        
        this.removeEventListeners();
        this.removeSocketEventListeners();

        // Leave game room
        if (this.roomId) {
            gameSocket.leaveGameRoom();
        }

        // Clean up any lingering countdown UI elements using multiple selectors
        const countdownElements = document.querySelectorAll('#countdownOverlay, [data-game-element="countdown"], .game-countdown-overlay');
        countdownElements.forEach(el => {
            el.remove();
        });

        const notificationsContainer = document.getElementById('notifications');
        if (notificationsContainer) {
            notificationsContainer.innerHTML = '';
        }
    }

    private forceReauthentication(): Promise<void> {
        return new Promise((resolve, reject) => {
            let isAuthenticated = false;
            
            // Listen for authentication success
            const authHandler = () => {
                isAuthenticated = true;
                window.removeEventListener('authenticated', authHandler);
                window.removeEventListener('auth_error', authErrorHandler);
                resolve();
            };
            
            // Listen for authentication failure
            const authErrorHandler = (event: any) => {
                console.error('Re-authentication failed:', event.detail);
                window.removeEventListener('authenticated', authHandler);
                window.removeEventListener('auth_error', authErrorHandler);
                reject(new Error('Re-authentication failed'));
            };
            
            // Set up temporary event listeners
            window.addEventListener('authenticated', authHandler);
            window.addEventListener('auth_error', authErrorHandler);
            
            // Force authentication by triggering the authenticate event
            gameSocket.forceAuthenticate();
            
            // Set timeout for re-authentication
            setTimeout(() => {
                if (!isAuthenticated) {
                    window.removeEventListener('authenticated', authHandler);
                    window.removeEventListener('auth_error', authErrorHandler);
                    console.error('Re-authentication timeout');
                    reject(new Error('Re-authentication timeout'));
                }
            }, 3000); // 3 second timeout for re-auth
        });
    }


    private parseGameParameters(): void {
        const pathParts = window.location.pathname.split('/');
        
        const sessionIndex = pathParts.indexOf('match') + 1;
        
        this.gameSessionId = sessionIndex > 0 ? pathParts[sessionIndex] : '';
        
        const urlParams = new URLSearchParams(window.location.search);
        
        this.roomId = urlParams.get('room') || '';
        
        if (!this.gameSessionId) {
            console.error('Missing game session ID!');
        }
        
        if (!this.roomId) {
            console.error('Missing room ID!');
        }
    }

    private bindElements(): void {
        this.gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    }

    private attachEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', this.handleBackClick.bind(this));
        }


        const readyButton = document.getElementById('readyButton');
        if (readyButton) {
            readyButton.addEventListener('click', this.handlePlayerReadyClick.bind(this));
        }

        const retryButton = document.getElementById('retryButton');
        if (retryButton) {
            retryButton.addEventListener('click', this.retryConnection.bind(this));
        }

        const playAgainButton = document.getElementById('playAgainButton');
        if (playAgainButton) {
            playAgainButton.addEventListener('click', this.handlePlayAgain.bind(this));
        }

        const backToLobbyButtons = document.querySelectorAll('#backToLobbyFromGameOver, #backToLobbyFromError');
        backToLobbyButtons.forEach(button => {
            button.addEventListener('click', this.navigateToLobby.bind(this));
        });

        // Chat functionality
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        const sendChatButton = document.getElementById('sendChatButton');
        const toggleChatButton = document.getElementById('toggleChatButton');

        if (chatInput && sendChatButton) {
            const sendMessage = () => {
                const message = chatInput.value.trim();
                if (message) {
                    gameSocket.sendGameChat(message);
                    chatInput.value = '';
                }
            };

            sendChatButton.addEventListener('click', sendMessage);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }

        if (toggleChatButton) {
            toggleChatButton.addEventListener('click', this.toggleChat.bind(this));
        }

        // Keyboard controls
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    private removeEventListeners(): void {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }

    private setupSocketEventListeners(): void {
        window.addEventListener('gameState', this.boundHandlers.gameState as EventListener);
        window.addEventListener('gameStarted', this.boundHandlers.gameStarted as EventListener);
        window.addEventListener('gameEnded', this.boundHandlers.gameEnded as EventListener);
        window.addEventListener('playerJoined', this.boundHandlers.playerJoined as EventListener);
        window.addEventListener('playerLeft', this.boundHandlers.playerLeft as EventListener);
        window.addEventListener('playerReady', this.boundHandlers.playerReady as EventListener);
        window.addEventListener('gameUpdate', this.boundHandlers.gameUpdate as EventListener);
        window.addEventListener('paddleUpdate', this.boundHandlers.paddleUpdate as EventListener);
        window.addEventListener('goalScored', this.boundHandlers.goalScored as EventListener);
        window.addEventListener('gamePaused', this.boundHandlers.gamePaused as EventListener);
        window.addEventListener('audioEvent', this.boundHandlers.audioEvent as EventListener);
        window.addEventListener('gameChatMessage', this.boundHandlers.gameChatMessage as EventListener);
        window.addEventListener('playerEmote', this.boundHandlers.playerEmote as EventListener);
    }

    private removeSocketEventListeners(): void {
        window.removeEventListener('gameState', this.boundHandlers.gameState as EventListener);
        window.removeEventListener('gameStarted', this.boundHandlers.gameStarted as EventListener);
        window.removeEventListener('gameEnded', this.boundHandlers.gameEnded as EventListener);
        window.removeEventListener('playerJoined', this.boundHandlers.playerJoined as EventListener);
        window.removeEventListener('playerLeft', this.boundHandlers.playerLeft as EventListener);
        window.removeEventListener('playerReady', this.boundHandlers.playerReady as EventListener);
        window.removeEventListener('gameUpdate', this.boundHandlers.gameUpdate as EventListener);
        window.removeEventListener('paddleUpdate', this.boundHandlers.paddleUpdate as EventListener);
        window.removeEventListener('goalScored', this.boundHandlers.goalScored as EventListener);
        window.removeEventListener('gamePaused', this.boundHandlers.gamePaused as EventListener);
        window.removeEventListener('audioEvent', this.boundHandlers.audioEvent as EventListener);
        window.removeEventListener('gameChatMessage', this.boundHandlers.gameChatMessage as EventListener);
        window.removeEventListener('playerEmote', this.boundHandlers.playerEmote as EventListener);
    }

    private async initializeRemoteGame(): Promise<void> {
        // Check if we already have an initialization in progress
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        
        if (this.isInitializing) {
            return;
        }
        
        if (this.isGameInitialized) {
            return;
        }
        
        if (this.gameManager) {
            return;
        }
        
        // Create initialization promise to track completion
        this.initializationPromise = this._doInitialization();
        
        try {
            await this.initializationPromise;
        } finally {
            this.initializationPromise = null;
        }
    }
    
    private async _doInitialization(): Promise<void> {
        if (this.isDisposed) {
            return;
        }
        
        this.isInitializing = true;
        
        if (!this.gameCanvas) {
            console.error('Game canvas not found');
            this.showError('Game canvas not available');
            this.isInitializing = false;
            return;
        }

        if (!this.gameSessionId || !this.roomId) {
            console.error(`Missing parameters - Session: "${this.gameSessionId}", Room: "${this.roomId}"`);
            this.showError('Invalid game parameters');
            this.isInitializing = false;
            return;
        }

        try {
            this.updateLoadingMessage('Connecting to game server...');
            
            if (this.isDisposed) {
                return;
            }
            
            // Join the game room via socket
            const sessionIdInt = parseInt(this.gameSessionId);
            
            gameSocket.joinGameRoom(this.roomId, sessionIdInt);
            
            if (this.isDisposed) {
                return;
            }
            
            this.updateLoadingMessage('Creating 3D engine...');
            
            // Ensure we don't create multiple game managers
            if (this.gameManager) {
                console.warn('Game manager already exists, disposing it first');
                try {
                    this.gameManager.dispose();
                } catch (error) {
                    console.warn('Error disposing existing game manager:', error);
                }
                this.gameManager = null;
            }
            
            if (this.isDisposed) {
                return;
            }
            
            this.gameManager = new PongGameManager(this.gameCanvas);
            
            // Verify the game manager is still valid before proceeding
            if (!this.gameManager || this.isDisposed) {
                console.error('Game manager became null or page disposed');
                this.showError('Failed to create game engine');
                this.isInitializing = false;
                return;
            }
            
            this.updateLoadingMessage('Initializing remote game session...');
            
            // Store reference to prevent race conditions and check it frequently
            const gameManagerRef = this.gameManager;
            
            if (gameManagerRef && this.gameManager === gameManagerRef && !this.isDisposed) {
                await gameManagerRef.initializeGameSession('remote', undefined, this.gameSessionId);
                
                // Final verification that nothing was cleaned up during async operation
                if (this.gameManager === gameManagerRef && this.isInitializing && !this.isDisposed) {
                    this.hideGameLoading();
                    this.showWaitingForOpponent();
                    this.updateConnectionStatus('connected');
                    
                    // Set these flags atomically
                    this.isGameInitialized = true;
                    this.isInitializing = false;
                } else {
                    console.error('Game manager was disposed during initialization or page was disposed');
                    console.error('  - gameManager === gameManagerRef:', this.gameManager === gameManagerRef);
                    console.error('  - isInitializing:', this.isInitializing);
                    console.error('  - isDisposed:', this.isDisposed);
                    if (!this.isDisposed) {
                        this.showError('Game initialization was interrupted');
                    }
                    this.isInitializing = false;
                }
            } else {
                console.error('Game manager became invalid during initialization or page disposed');
                if (!this.isDisposed) {
                    this.showError('Failed to create game manager');
                }
                this.isInitializing = false;
            }
        } catch (error) {
            console.error('Failed to initialize remote game:', error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            if (!this.isDisposed) {
                this.showError('Failed to initialize game. Please try again.');
            }
            this.isInitializing = false;
        }
    }

    private updateLoadingMessage(message: string): void {
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
    }

    private hideGameLoading(): void {
        const gameLoading = document.getElementById('gameLoading');
        if (gameLoading) {
            gameLoading.classList.add('hidden');
        }
    }

    private showWaitingForOpponent(): void {
        const waitingOverlay = document.getElementById('waitingOverlay');
        if (waitingOverlay) {
            waitingOverlay.classList.remove('hidden');
        }
    }

    private showReadyOverlay(): void {
        const waitingOverlay = document.getElementById('waitingOverlay');
        const readyOverlay = document.getElementById('readyOverlay');
        
        if (waitingOverlay) waitingOverlay.classList.add('hidden');
        if (readyOverlay) readyOverlay.classList.remove('hidden');
    }

    private hideAllOverlays(): void {
        const overlays = ['gameLoading', 'waitingOverlay', 'readyOverlay', 'gameOverOverlay', 'errorOverlay'];
        overlays.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.add('hidden');
        });
    }

    private showError(message: string): void {
        const errorOverlay = document.getElementById('errorOverlay');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorMessage) errorMessage.textContent = message;
        if (errorOverlay) {
            this.hideAllOverlays();
            errorOverlay.classList.remove('hidden');
        }
    }

    private updateConnectionStatus(status: 'connecting' | 'connected' | 'disconnected'): void {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        switch (status) {
            case 'connecting':
                statusElement.innerHTML = `
                    <div class="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                    <span class="text-sm text-yellow-400">Connecting...</span>
                `;
                break;
            case 'connected':
                statusElement.innerHTML = `
                    <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span class="text-sm text-green-400">Connected</span>
                `;
                break;
            case 'disconnected':
                statusElement.innerHTML = `
                    <div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                    <span class="text-sm text-red-400">Disconnected</span>
                `;
                break;
        }
    }

    private handleBackClick(): void {
        // Quit the game first
        gameSocket.quitGame();
        
        // Explicitly call cleanup to ensure game resources are disposed
        this.cleanup();
        
        // Then navigate
        this.navigateToLobby();
    }


    private handlePlayerReadyClick(): void {
        gameSocket.playerReady();
        
        const readyButton = document.getElementById('readyButton');
        if (readyButton) {
            readyButton.textContent = 'Ready!';
            readyButton.classList.remove('bg-green-600', 'hover:bg-green-700');
            readyButton.classList.add('bg-gray-600');
            (readyButton as HTMLButtonElement).disabled = true;
        } else {
            console.warn('Ready button element not found');
        }
    }

    private retryConnection(): void {
        this.hideAllOverlays();
        this.updateConnectionStatus('connecting');
        this.initializeRemoteGame();
    }

    private async handlePlayAgain(): Promise<void> {
        if (!this.opponentUserId || !this.opponentUsername) {
            console.warn('Opponent information not found, showing error notification');
            showNotification('Unable to find opponent information', 'error');
            return;
        }

        try {
            const invitationData = {
                receiver_id: this.opponentUserId,
                game_mode: 'remote',
                message: `Challenge you to another Pong match!`
            };
            
            const response = await fetch('/api/game/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(invitationData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification(`Rematch invitation sent to ${this.opponentUsername}!`, 'success');
                
                // Navigate back to lobby to see the invitation status
                setTimeout(() => {
                    this.navigateToLobby();
                }, 1500);
            } else {
                console.error('Failed to send rematch invitation:', data);
                showNotification(data.error || 'Failed to send rematch invitation', 'error');
            }
        } catch (error) {
            console.error('Error sending rematch invitation:', error);
            showNotification('Failed to send rematch invitation', 'error');
        }
    }

    private navigateToLobby(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: '/game/online' }
        });
        window.dispatchEvent(event);
    }

    private toggleChat(): void {
        const chatContainer = document.getElementById('gameChatContainer');
        if (chatContainer) {
            chatContainer.classList.toggle('hidden');
        }
    }

    private handleKeyDown(event: KeyboardEvent): void {
        // Only handle keys if we're on the remote game page
        if (!window.location.pathname.includes('/game/remote/')) {
            return;
        }
        
        if (!this.isGameInitialized) {
            return;
        }
        
        // Ignore key presses when user is typing in input fields
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.hasAttribute('contenteditable')
        )) {
            return;
        }
        
        // Prevent key repeat
        if (this.keysPressed.has(event.key)) {
            return;
        }
        
        this.keysPressed.add(event.key);
        
        switch (event.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                event.preventDefault();
                if (this.currentPaddleDirection !== 'up') {
                    this.currentPaddleDirection = 'up';
                    gameSocket.startMovingPaddle('up');
                }
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                event.preventDefault();
                if (this.currentPaddleDirection !== 'down') {
                    this.currentPaddleDirection = 'down';
                    gameSocket.startMovingPaddle('down');
                }
                break;
            case 'Enter':
                event.preventDefault();
                this.toggleChat();
                const chatInput = document.getElementById('chatInput') as HTMLInputElement;
                if (chatInput) chatInput.focus();
                break;
            default:
                break;
        }
    }

    private handleKeyUp(event: KeyboardEvent): void {
        // Only handle keys if we're on the remote game page
        if (!window.location.pathname.includes('/game/remote/')) {
            return;
        }
        
        if (!this.isGameInitialized) {
            return;
        }

        // Ignore key presses when user is typing in input fields
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.hasAttribute('contenteditable')
        )) {
            return;
        }

        this.keysPressed.delete(event.key);
        
        switch (event.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                event.preventDefault();
                if (this.currentPaddleDirection === 'up') {
                    // Check if down key is still pressed
                    const downKeys = ['ArrowDown', 's', 'S'];
                    const isDownPressed = downKeys.some(key => this.keysPressed.has(key));
                    
                    if (isDownPressed) {
                        this.currentPaddleDirection = 'down';
                        gameSocket.startMovingPaddle('down');
                    } else {
                        this.currentPaddleDirection = null;
                        gameSocket.stopMovingPaddle();
                    }
                }
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                event.preventDefault();
                if (this.currentPaddleDirection === 'down') {
                    // Check if up key is still pressed
                    const upKeys = ['ArrowUp', 'w', 'W'];
                    const isUpPressed = upKeys.some(key => this.keysPressed.has(key));
                    
                    if (isUpPressed) {
                        this.currentPaddleDirection = 'up';
                        gameSocket.startMovingPaddle('up');
                    } else {
                        this.currentPaddleDirection = null;
                        gameSocket.stopMovingPaddle();
                    }
                }
                break;
        }
    }

    // Socket event handlers
    private handleGameState(event: Event): void {
        // Prevent handling events if page is being cleaned up
        if (!this.isGameInitialized && !this.isInitializing) {
            return;
        }
        
        const eventDetail = (event as CustomEvent).detail;
        
        const { players, your_role } = eventDetail;
        
        // Detailed player analysis and capture opponent information
        if (players) {
            // Find opponent information
            const currentUserId = this.currentUser?.id;
            Object.entries(players).forEach(([playerId, playerData]: [string, any]) => {
                // Store opponent information for rematch functionality
                if (currentUserId && String(playerId) !== String(currentUserId)) {
                    this.opponentUserId = playerId;
                    this.opponentUsername = playerData.username;
                }
            });
        } else {
            console.warn('No players object in game state');
        }
        
        this.isPlayer1 = your_role === 'player1';
        
        // Set camera perspective based on player role
        if (this.gameManager) {
            this.gameManager.setPlayerCameraPerspective();
        }
        
        // Update player names
        const player1Element = document.getElementById('player1Name');
        const player2Element = document.getElementById('player2Name');
        
        if (player1Element && player2Element) {
            const player1Name = this.isPlayer1 ? 'You (BLUE RIGHT)' : 'Opponent (BLUE RIGHT)';
            const player2Name = this.isPlayer1 ? 'Opponent (YELLOW LEFT)' : 'You (YELLOW LEFT)';
            
            player1Element.textContent = player1Name;
            player2Element.textContent = player2Name;
        } else {
            console.warn('Player name elements not found');
        }
        
        // Check if both players are connected
        const playerCount = Object.keys(players || {}).length;
        
        if (playerCount >= 2) {
            this.opponentConnected = true;
            this.showReadyOverlay();
        }
    }

    private handleGameStarted(event: Event): void {
        this.hideAllOverlays();
        
        // Force hide loading screen specifically to handle race conditions
        const gameLoading = document.getElementById('gameLoading');
        if (gameLoading && !gameLoading.classList.contains('hidden')) {
            gameLoading.classList.add('hidden');
        }
        
        // Ensure camera perspective is set correctly when game starts
        if (this.gameManager && this.isPlayer1 !== undefined) {
            this.gameManager.setPlayerCameraPerspective();
        }
        
        
        // console.log('Game is now active!');
        // showNotification('Game started! Good luck!', 'success');
    }

    private handleGameEnded(event: Event): void {
        const { winner, final_score, reason } = (event as CustomEvent).detail;
        
        const gameOverOverlay = document.getElementById('gameOverOverlay');
        const resultTitle = document.getElementById('resultTitle');
        const resultMessage = document.getElementById('resultMessage');
        const finalPlayer1Score = document.getElementById('finalPlayer1Score');
        const finalPlayer2Score = document.getElementById('finalPlayer2Score');
        
        if (gameOverOverlay) {
            this.hideAllOverlays();
            gameOverOverlay.classList.remove('hidden');
        }
        
        if (resultTitle && resultMessage) {
            if (reason === 'forfeit' || reason === 'disconnect') {
                resultTitle.textContent = 'Game Ended';
                resultMessage.textContent = `Game ended due to ${reason}`;
            } else {
                const isWinner = (winner === 'player1' && this.isPlayer1) || (winner === 'player2' && !this.isPlayer1);
                resultTitle.textContent = isWinner ? 'Victory!' : 'Defeat';
                resultTitle.className = `text-3xl font-bold mb-2 ${isWinner ? 'text-green-400' : 'text-red-400'}`;
                resultMessage.textContent = isWinner ? 'Congratulations!' : 'Better luck next time!';
            }
        }
        
        if (finalPlayer1Score && finalPlayer2Score && final_score) {
            finalPlayer1Score.textContent = final_score.player1.toString();
            finalPlayer2Score.textContent = final_score.player2.toString();
        }
        
        // Ensure opponent information is preserved for rematch functionality
    }

    private handlePlayerJoined(event: Event): void {
        const eventDetail = (event as CustomEvent).detail;
        
        const { user } = eventDetail;
        
        if (user && user.username) {
            // showNotification(`${user.username} joined the game`, 'info');
            
            // Store opponent information when they join
            const currentUserId = this.currentUser?.id;
            if (currentUserId && String(user.user_id) !== String(currentUserId)) {
                this.opponentUserId = String(user.user_id);
                this.opponentUsername = user.username;
            }
        } else {
            console.warn('Missing user information in player joined event');
            showNotification('A player joined the game', 'info');
        }
        
        this.opponentConnected = true;
        this.showReadyOverlay();
    }

    private handlePlayerLeft(event: Event): void {
        const { user } = (event as CustomEvent).detail;
        
        showNotification(`${user.username} left the game`, 'error');
        this.opponentConnected = false;
        
        // DO NOT clear opponent information here - we need it for rematch functionality
        // The opponent info should persist even after they leave
    }

    private handlePlayerReady(event: Event): void {
        const { user, ready_count, total_players } = (event as CustomEvent).detail;
        
        const readyStatus = document.getElementById('readyStatus');
        if (readyStatus) {
            const statusText = `${ready_count}/${total_players} players ready`;
            readyStatus.textContent = statusText;
        } else {
            console.warn('Ready status element not found');
        }
        
        showNotification(`${user.username} is ready!`, 'info');
    }

    private handleGameUpdate(event: Event): void {
        const { ball, paddle1, paddle2, timestamp: _timestamp } = (event as CustomEvent).detail;
        
        // Safety check: if we receive game updates, the game has definitely started
        // Force hide loading screen in case it's still visible due to race conditions
        const gameLoading = document.getElementById('gameLoading');
        if (gameLoading && !gameLoading.classList.contains('hidden')) {
            gameLoading.classList.add('hidden');
        }
        
        // Update score display
        const player1Score = document.getElementById('player1Score');
        const player2Score = document.getElementById('player2Score');
        
        if (player1Score) player1Score.textContent = paddle1.score.toString();
        if (player2Score) player2Score.textContent = paddle2.score.toString();
        
        // Update the actual 3D ball and paddle positions in the game engine
        if (this.gameManager) {
            this.syncBackendStateToFrontend(ball, paddle1, paddle2);
        }
    }

    private syncBackendStateToFrontend(ball: any, paddle1: any, paddle2: any): void {
        try {
            // Use the PongGameManager's sync method to update the 3D engine
            this.gameManager?.syncRemoteGameState(ball, paddle1, paddle2);
        } catch (error) {
            console.warn('Error syncing backend state:', error);
        }
    }

    private handlePaddleUpdate(_event: Event): void {
        // Handle paddle position updates if needed
    }

    private handleGoalScored(event: Event): void {
        const { player1_score, player2_score } = (event as CustomEvent).detail;
        
        // Play score sound
        if (this.gameManager) {
            this.gameManager.playAudio('score');
        }
        
        // const isMyGoal = (scorer === 'player1' && this.isPlayer1) || (scorer === 'player2' && !this.isPlayer1);
        // showNotification(`${isMyGoal ? 'You' : 'Opponent'} scored!`, isMyGoal ? 'success' : 'error');
        
        // Update scores
        const player1Score = document.getElementById('player1Score');
        const player2Score = document.getElementById('player2Score');
        
        if (player1Score) player1Score.textContent = player1_score.toString();
        if (player2Score) player2Score.textContent = player2_score.toString();
    }

    private handleGamePaused(event: Event): void {
        const { paused_by, is_paused } = (event as CustomEvent).detail;
        showNotification(`Game ${is_paused ? 'paused' : 'resumed'} by ${paused_by}`, 'info');
    }

    private handleAudioEvent(event: Event): void {
        const { type } = (event as CustomEvent).detail;
        
        if (this.gameManager) {
            this.gameManager.playAudio(type);
        }
    }

    private handleChatMessage(event: Event): void {
        const { user, message } = (event as CustomEvent).detail;
        
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const messageElement = document.createElement('div');
            messageElement.className = 'mb-1';
            messageElement.innerHTML = `
                <span class="text-gray-400 text-xs">${user.username}:</span>
                <span class="text-white ml-1">${message}</span>
            `;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        // Show chat container if hidden
        const chatContainer = document.getElementById('gameChatContainer');
        if (chatContainer && chatContainer.classList.contains('hidden')) {
            chatContainer.classList.remove('hidden');
            setTimeout(() => {
                chatContainer.classList.add('hidden');
            }, 5000);
        }
    }

    private handlePlayerEmote(event: Event): void {
        const { user, emote } = (event as CustomEvent).detail;
        showNotification(`${user.username}: ${emote}`, 'info', 2000);
    }
}