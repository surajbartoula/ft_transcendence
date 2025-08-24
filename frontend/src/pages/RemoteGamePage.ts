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
    private gameSessionId: string = '';
    private roomId: string = '';
    private isPlayer1: boolean = false;
    private player1Name: string = 'Player 1';
    private player2Name: string = 'Player 2';
    private currentUser: any = null;
    private opponentConnected: boolean = false;
    private keysPressed: Set<string> = new Set();
    private currentPaddleDirection: 'up' | 'down' | null = null;
    private updateCount: number = 0;
    
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
            <div class="fixed inset-0 bg-slate-900 flex flex-col h-screen">
                <!-- Remote Game Header -->
                <div class="bg-slate-800 border-b border-slate-700 p-3 z-20 relative">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors z-30 relative">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Exit Game</span>
                            </button>
                            <div class="h-6 w-px bg-slate-600"></div>
                            <h1 class="text-xl font-bold text-white">Remote Match</h1>
                        </div>
                        <div class="flex items-center space-x-6">
                            <!-- Player Status -->
                            <div class="flex items-center space-x-4">
                                <div class="text-center">
                                    <div id="player1Name" class="text-white font-semibold">${this.player1Name}</div>
                                    <div id="player1Score" class="text-2xl font-bold text-blue-400">0</div>
                                </div>
                                <div class="text-2xl text-gray-400 font-bold">VS</div>
                                <div class="text-center">
                                    <div id="player2Name" class="text-white font-semibold">${this.player2Name}</div>
                                    <div id="player2Score" class="text-2xl font-bold text-red-400">0</div>
                                </div>
                            </div>
                            <!-- Connection Status -->
                            <div class="flex items-center space-x-2">
                                <div id="connectionStatus" class="flex items-center">
                                    <div class="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                                    <span class="text-sm text-yellow-400">Connecting...</span>
                                </div>
                                <button id="fullscreenButton" class="p-2 text-gray-300 hover:text-white transition-colors">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                                    </svg>
                                </button>
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
        console.log('🎮 RemoteGamePage: Starting initialization...');
        console.log('🎮 Current URL:', window.location.href);
        console.log('🎮 Pathname:', window.location.pathname);
        console.log('🎮 Search params:', window.location.search);
        
        this.currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
        console.log('👤 Current user:', this.currentUser);
        
        this.parseGameParameters();
        this.bindElements();
        this.attachEventListeners();
        this.setupSocketEventListeners();

        // Connect to game socket if not already connected
        const socketConnected = gameSocket.isConnected();
        console.log(`🔌 Socket connection status: ${socketConnected}`);
        
        if (!socketConnected) {
            console.log('🔌 Connecting to game socket...');
            gameSocket.connect();
        }

        console.log('⏱️ Waiting 100ms before initializing remote game...');
        setTimeout(() => {
            this.initializeRemoteGame();
        }, 100);
    }

    public cleanup(): void {
        console.log('🎮 Cleaning up Remote Game Page...');
        
        // Stop any ongoing paddle movement
        if (this.currentPaddleDirection !== null) {
            console.log('🛑 CLEANUP: Stopping paddle movement before page cleanup');
            gameSocket.stopMovingPaddle();
            this.currentPaddleDirection = null;
        }
        this.keysPressed.clear();
        
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
        this.removeSocketEventListeners();

        // Leave game room
        if (this.roomId) {
            console.log(`🚪 RemoteGamePage: Leaving game room ${this.roomId}`);
            gameSocket.leaveGameRoom();
        }

        const notificationsContainer = document.getElementById('notifications');
        if (notificationsContainer) {
            notificationsContainer.innerHTML = '';
        }
        
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(console.warn);
        }
    }

    private parseGameParameters(): void {
        console.log('🔍 RemoteGamePage: Parsing game parameters...');
        
        const pathParts = window.location.pathname.split('/');
        console.log('🔍 Path parts:', pathParts);
        
        const sessionIndex = pathParts.indexOf('match') + 1;
        console.log(`🔍 Match index: ${pathParts.indexOf('match')}, Session index: ${sessionIndex}`);
        
        this.gameSessionId = sessionIndex > 0 ? pathParts[sessionIndex] : '';
        
        const urlParams = new URLSearchParams(window.location.search);
        console.log('🔍 URL search params:', window.location.search);
        
        this.roomId = urlParams.get('room') || '';

        console.log(`🎮 RemoteGamePage: Parsed parameters - Session: "${this.gameSessionId}", Room: "${this.roomId}"`);
        
        if (!this.gameSessionId) {
            console.error('❌ Missing game session ID!');
        }
        
        if (!this.roomId) {
            console.error('❌ Missing room ID!');
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

        const fullscreenButton = document.getElementById('fullscreenButton');
        if (fullscreenButton) {
            fullscreenButton.addEventListener('click', this.handleFullscreenClick.bind(this));
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
        console.log('🔧 RemoteGamePage: Setting up socket event listeners');
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
        console.log('🔧 RemoteGamePage: Removing socket event listeners');
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
        console.log('🎮 RemoteGamePage: Starting remote game initialization...');
        
        if (!this.gameCanvas) {
            console.error('❌ RemoteGamePage: Game canvas not found');
            this.showError('Game canvas not available');
            return;
        }
        console.log('✅ Game canvas found:', this.gameCanvas);

        if (!this.gameSessionId || !this.roomId) {
            console.error(`❌ RemoteGamePage: Missing parameters - Session: "${this.gameSessionId}", Room: "${this.roomId}"`);
            this.showError('Invalid game parameters');
            return;
        }
        console.log('✅ Game parameters validated');

        try {
            console.log('🚀 RemoteGamePage: Starting remote game initialization sequence...');
            
            this.updateLoadingMessage('Connecting to game server...');
            console.log('⏱️ Step 1: Connecting to game server...');
            
            // Join the game room via socket
            console.log(`🏠 Step 2: Joining game room - Room: ${this.roomId}, Session: ${this.gameSessionId}`);
            const sessionIdInt = parseInt(this.gameSessionId);
            console.log(`🔢 Parsed session ID: ${sessionIdInt}`);
            
            gameSocket.joinGameRoom(this.roomId, sessionIdInt);
            console.log('✅ Game room join request sent via socket');
            
            this.updateLoadingMessage('Creating 3D engine...');
            console.log('⏱️ Step 3: Creating 3D engine...');
            
            console.log('🏓 Step 4: Creating PongGameManager...');
            this.gameManager = new PongGameManager(this.gameCanvas);
            console.log('✅ PongGameManager created:', this.gameManager);
            
            this.updateLoadingMessage('Initializing remote game session...');
            console.log('⏱️ Step 4: Initializing game session...');
            
            // Small delay to let 3D engine initialize properly
            await new Promise(resolve => setTimeout(resolve, 300));

            if (this.gameManager) {
                console.log('🎮 Step 6: Initializing game session with mode "remote"...');
                console.log(`🆔 Using existing session ID: ${this.gameSessionId}`);
                await this.gameManager.initializeGameSession('remote', undefined, this.gameSessionId);
                console.log('✅ Remote game session initialized successfully');
                
                console.log('💻 Hiding loading screen and showing waiting overlay...');
                this.hideGameLoading();
                this.showWaitingForOpponent();
                this.updateConnectionStatus('connected');
                
                this.isGameInitialized = true;
                console.log('✅ RemoteGamePage: Initialization complete!');
            } else {
                console.error('❌ Game manager is null after creation');
                this.showError('Failed to create game manager');
            }
        } catch (error) {
            console.error('❌ RemoteGamePage: Failed to initialize remote game:', error);
            console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            this.showError('Failed to initialize game. Please try again.');
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
        const confirmed = confirm('Are you sure you want to leave the game? This will forfeit the match.');
        if (confirmed) {
            gameSocket.quitGame();
            this.navigateToLobby();
        }
    }

    private handleFullscreenClick(): void {
        const gameContainer = document.getElementById('gameContainer');
        if (!gameContainer) return;

        if (!document.fullscreenElement) {
            gameContainer.requestFullscreen().catch(console.warn);
        } else {
            document.exitFullscreen().catch(console.warn);
        }
    }

    private handlePlayerReadyClick(): void {
        console.log('🎯 DEBUG: Ready button clicked!');
        
        console.log('📤 DEBUG: Sending playerReady signal via gameSocket...');
        gameSocket.playerReady();
        
        const readyButton = document.getElementById('readyButton');
        if (readyButton) {
            console.log('🔘 DEBUG: Updating ready button state...');
            readyButton.textContent = 'Ready!';
            readyButton.classList.remove('bg-green-600', 'hover:bg-green-700');
            readyButton.classList.add('bg-gray-600');
            (readyButton as HTMLButtonElement).disabled = true;
            console.log('✅ DEBUG: Ready button updated to disabled state');
        } else {
            console.warn('⚠️ DEBUG: Ready button element not found');
        }
    }

    private retryConnection(): void {
        this.hideAllOverlays();
        this.updateConnectionStatus('connecting');
        this.initializeRemoteGame();
    }

    private handlePlayAgain(): void {
        // This would send a new game invitation to the same opponent
        showNotification('Feature coming soon!', 'info');
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
        if (!this.isGameInitialized) {
            console.log('⚠️ RemoteGamePage: Key pressed but game not initialized yet');
            return;
        }
        
        // Prevent key repeat
        if (this.keysPressed.has(event.key)) {
            return;
        }
        
        console.log(`⌨️ PADDLE_DEBUG: Key pressed: ${event.key} - I am Player${this.isPlayer1 ? '1' : '2'} (${this.currentUser?.name || 'Unknown'})`);
        this.keysPressed.add(event.key);
        
        switch (event.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                event.preventDefault();
                if (this.currentPaddleDirection !== 'up') {
                    console.log(`⬆️ PADDLE_DEBUG: Starting UP movement for Player${this.isPlayer1 ? '1' : '2'}`);
                    this.currentPaddleDirection = 'up';
                    gameSocket.startMovingPaddle('up');
                }
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                event.preventDefault();
                if (this.currentPaddleDirection !== 'down') {
                    console.log(`⬇️ PADDLE_DEBUG: Starting DOWN movement for Player${this.isPlayer1 ? '1' : '2'}`);
                    this.currentPaddleDirection = 'down';
                    gameSocket.startMovingPaddle('down');
                }
                break;
            case 'Enter':
                event.preventDefault();
                console.log('💬 Toggling chat and focusing input');
                this.toggleChat();
                const chatInput = document.getElementById('chatInput') as HTMLInputElement;
                if (chatInput) chatInput.focus();
                break;
            default:
                console.log(`⌨️ Unhandled key: ${event.key}`);
        }
    }

    private handleKeyUp(event: KeyboardEvent): void {
        if (!this.isGameInitialized) {
            return;
        }

        this.keysPressed.delete(event.key);
        console.log(`⌨️ PADDLE_DEBUG: Key released: ${event.key}`);
        
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
                        console.log(`⬇️ PADDLE_DEBUG: Switching to DOWN movement (down key still pressed)`);
                        this.currentPaddleDirection = 'down';
                        gameSocket.startMovingPaddle('down');
                    } else {
                        console.log(`🛑 PADDLE_DEBUG: Stopping paddle movement (UP key released)`);
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
                        console.log(`⬆️ PADDLE_DEBUG: Switching to UP movement (up key still pressed)`);
                        this.currentPaddleDirection = 'up';
                        gameSocket.startMovingPaddle('up');
                    } else {
                        console.log(`🛑 PADDLE_DEBUG: Stopping paddle movement (DOWN key released)`);
                        this.currentPaddleDirection = null;
                        gameSocket.stopMovingPaddle();
                    }
                }
                break;
        }
    }

    // Socket event handlers
    private handleGameState(event: Event): void {
        const eventDetail = (event as CustomEvent).detail;
        console.log('🔥🔥🔥 GAME STATE EVENT RECEIVED! 🔥🔥🔥');
        console.log('🔥 RemoteGamePage: Full game state received:', eventDetail);
        
        const { room_id, game_session, game_state, players, your_role } = eventDetail;
        console.log('🏠 Room ID:', room_id);
        console.log('🎮 Game session:', game_session);
        console.log('🎯 Game state:', game_state);
        console.log('🎭 Your role:', your_role);
        console.log('👥 Players object:', players);
        
        // Detailed player analysis
        if (players) {
            const playerIds = Object.keys(players);
            console.log(`👥 Player IDs: [${playerIds.join(', ')}]`);
            console.log('👥 Player details:');
            Object.entries(players).forEach(([playerId, playerData]: [string, any]) => {
                console.log(`  - Player ${playerId}: ${playerData.username} (Player 1: ${playerData.is_player1}, Ready: ${playerData.ready})`);
            });
        } else {
            console.warn('⚠️ No players object in game state');
        }
        
        this.isPlayer1 = your_role === 'player1';
        console.log(`👤 FRONTEND ROLE DEBUG:`);
        console.log(`  - Received your_role: "${your_role}" (type: ${typeof your_role})`);
        console.log(`  - Current user ID: ${this.currentUser?.id || 'undefined'}`);
        console.log(`  - Determined isPlayer1: ${this.isPlayer1}`);
        
        // Set camera perspective based on player role
        if (this.gameManager) {
            console.log(`📷 Setting camera perspective for Player${this.isPlayer1 ? '1' : '2'}`);
            this.gameManager.setPlayerCameraPerspective(this.isPlayer1);
        }
        
        // Update player names
        const player1Element = document.getElementById('player1Name');
        const player2Element = document.getElementById('player2Name');
        
        if (player1Element && player2Element) {
            const player1Name = this.isPlayer1 ? 'You (GREEN LEFT)' : 'Opponent (GREEN LEFT)';
            const player2Name = this.isPlayer1 ? 'Opponent (RED RIGHT)' : 'You (RED RIGHT)';
            
            console.log(`🏷️ Setting player names - Player 1: ${player1Name}, Player 2: ${player2Name}`);
            
            player1Element.textContent = player1Name;
            player2Element.textContent = player2Name;
        } else {
            console.warn('⚠️ Player name elements not found');
        }
        
        // Check if both players are connected
        const playerCount = Object.keys(players || {}).length;
        console.log(`👥 Player count: ${playerCount}`);
        
        // Check current UI state
        const waitingOverlay = document.getElementById('waitingOverlay');
        const readyOverlay = document.getElementById('readyOverlay');
        console.log(`📺 Current UI state - Waiting overlay hidden: ${waitingOverlay?.classList.contains('hidden')}, Ready overlay hidden: ${readyOverlay?.classList.contains('hidden')}`);
        
        if (playerCount >= 2) {
            console.log('✅ Both players connected! Showing ready overlay...');
            this.opponentConnected = true;
            console.log('🔄 Calling showReadyOverlay()...');
            this.showReadyOverlay();
            
            // Verify UI state after change
            setTimeout(() => {
                console.log(`📺 After showReadyOverlay - Waiting overlay hidden: ${waitingOverlay?.classList.contains('hidden')}, Ready overlay hidden: ${readyOverlay?.classList.contains('hidden')}`);
            }, 100);
        } else {
            console.log('⏳ Waiting for more players...');
        }
    }

    private handleGameStarted(event: Event): void {
        const eventDetail = (event as CustomEvent).detail;
        console.log('🎮 RemoteGamePage: Game started!', eventDetail);
        
        console.log('💻 Force hiding all overlays including loading screen...');
        this.hideAllOverlays();
        
        // Force hide loading screen specifically to handle race conditions
        const gameLoading = document.getElementById('gameLoading');
        if (gameLoading && !gameLoading.classList.contains('hidden')) {
            console.log('🔧 Loading screen was still visible - force hiding it');
            gameLoading.classList.add('hidden');
        }
        
        // Ensure camera perspective is set correctly when game starts
        if (this.gameManager && this.isPlayer1 !== undefined) {
            console.log(`📷 RE-SETTING camera perspective on game start for Player${this.isPlayer1 ? '1' : '2'}`);
            this.gameManager.setPlayerCameraPerspective(this.isPlayer1);
        }
        
        
        // console.log('✅ Game is now active!');
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
    }

    private handlePlayerJoined(event: Event): void {
        const eventDetail = (event as CustomEvent).detail;
        console.log('🔥🔥🔥 PLAYER JOINED EVENT RECEIVED! 🔥🔥🔥');
        console.log('🔥 RemoteGamePage: Player joined:', eventDetail);
        
        const { user } = eventDetail;
        console.log('👤 Joined user:', user);
        
        if (user && user.username) {
            console.log(`✅ ${user.username} joined the game`);
            showNotification(`${user.username} joined the game`, 'info');
        } else {
            console.warn('⚠️ Missing user information in player joined event');
            showNotification('A player joined the game', 'info');
        }
        
        this.opponentConnected = true;
        console.log('👥 Opponent is now connected, showing ready overlay...');
        this.showReadyOverlay();
    }

    private handlePlayerLeft(event: Event): void {
        const { user } = (event as CustomEvent).detail;
        showNotification(`${user.username} left the game`, 'error');
        this.opponentConnected = false;
    }

    private handlePlayerReady(event: Event): void {
        const { user, ready_count, total_players } = (event as CustomEvent).detail;
        console.log('✅ DEBUG: Player ready event received:', { user, ready_count, total_players });
        
        const readyStatus = document.getElementById('readyStatus');
        if (readyStatus) {
            const statusText = `${ready_count}/${total_players} players ready`;
            console.log(`📊 DEBUG: Updating ready status: ${statusText}`);
            readyStatus.textContent = statusText;
        } else {
            console.warn('⚠️ DEBUG: Ready status element not found');
        }
        
        console.log(`🔔 DEBUG: Showing notification for ${user.username} ready`);
        showNotification(`${user.username} is ready!`, 'info');
        
        // Check if we should start the game
        if (ready_count === total_players && total_players === 2) {
            console.log('🎮 DEBUG: All players ready! Game should start soon...');
        } else {
            console.log(`⏳ DEBUG: Still waiting - ${ready_count}/${total_players} ready`);
        }
    }

    private handleGameUpdate(event: Event): void {
        const { ball, paddle1, paddle2, timestamp: _timestamp } = (event as CustomEvent).detail;
        
        // Safety check: if we receive game updates, the game has definitely started
        // Force hide loading screen in case it's still visible due to race conditions
        const gameLoading = document.getElementById('gameLoading');
        if (gameLoading && !gameLoading.classList.contains('hidden')) {
            console.log('🔧 Game update received but loading screen still visible - force hiding');
            gameLoading.classList.add('hidden');
        }
        
        // Debug log every 60th update (once per second at 60fps) to avoid spam
        if (!this.updateCount) this.updateCount = 0;
        this.updateCount++;
        
        if (this.updateCount % 60 === 1) {
            console.log(`🎮 DEBUG: Frontend received game_update #${this.updateCount}:`, {
                ball_pos: `(${ball.x.toFixed(1)}, ${ball.y.toFixed(1)})`,
                ball_vel: `(${ball.vx.toFixed(1)}, ${ball.vy.toFixed(1)})`,
                p1_score: paddle1.score,
                p2_score: paddle2.score,
                timestamp: _timestamp
            });
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
            console.warn('⚠️ RemoteGamePage: Error syncing backend state:', error);
        }
    }

    private handlePaddleUpdate(event: Event): void {
        // Handle paddle position updates if needed
    }

    private handleGoalScored(event: Event): void {
        const { scorer, player1_score, player2_score } = (event as CustomEvent).detail;
        
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
        const { user, message, timestamp } = (event as CustomEvent).detail;
        
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