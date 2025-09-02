import { GameStateManager } from "./GameStateManager";
import { RenderEngine } from "./RenderEngine";
import { InputManager } from "./InputManager";
import { PhysicsSystem } from "./PhysicsSystem";
import { ScoreManager } from "./ScoreManager";
import { UIManager } from "./UIManager";
import { AudioManager } from "./AudioManager";
import { AIPlayer } from "./AIPlayer";
import { TournamentManager } from "./TournamentManager";

// =====================================
// PONG GAME MANAGER
// =====================================
export class PongGameManager {
    private gameState: GameStateManager;
    private renderEngine: RenderEngine;
    private inputManager: InputManager;
    private physicsSystem: PhysicsSystem;
    private audioManager: AudioManager;
    private uiManager: UIManager;
    private scoreManager: ScoreManager;
    private aiPlayer: AIPlayer;
    private tournamentManager: TournamentManager;
    private isRunning: boolean = false;
    private lastTime: number = 0;
    private animationFrameId: number | null = null;
    private gameLoopFn: ((timestamp: number) => void) | null = null;
    private isDisposed: boolean = false;
    private isInitializing: boolean = false;
    
    // Game session tracking
    private currentGameMode: 'local' | 'ai' | 'remote' | 'tournament' = 'local';
    private currentGameSessionId: string | null = null;

    constructor(canvas: HTMLCanvasElement) {
        // Initialize core systems
        this.renderEngine = new RenderEngine(canvas);
        this.inputManager = new InputManager();
        this.physicsSystem = new PhysicsSystem();
        this.audioManager = new AudioManager();
        this.uiManager = new UIManager();
        this.scoreManager = new ScoreManager();
        
        // Initialize game state manager with core systems only
        // (GameStateManager creates its own aiPlayer and tournamentManager)
        this.gameState = new GameStateManager({
            renderEngine: this.renderEngine,
            inputManager: this.inputManager,
            physicsSystem: this.physicsSystem,
            audioManager: this.audioManager,
            uiManager: this.uiManager,
            scoreManager: this.scoreManager
        }, this);

        // Get references to AI and Tournament systems from GameStateManager
        this.aiPlayer = this.gameState.getAIPlayer();
        this.tournamentManager = this.gameState.getTournamentManager();

        this.initialize();
    }

    private async initialize(): Promise<void> {
        if (this.isDisposed) {
            throw new Error('Cannot initialize disposed PongManager');
        }
        
        this.isInitializing = true;
        
        try {
            // Initialize all systems in proper order
            await this.renderEngine.initialize();
            
            // Check if disposed during async initialization
            if (this.isDisposed) {
                return;
            }
            
            this.inputManager.initialize();
            this.physicsSystem.initialize();
            this.audioManager.initialize();
            this.uiManager.initialize();
            this.scoreManager.initialize();

            this.scoreManager.setScoreChangeCallback(({ leftScore, rightScore, scorer }) => {
                if (this.isDisposed) return; // Guard against disposal during callback
                this.uiManager.showScoreFlash({ 
                    scorer, 
                    leftScore, 
                    rightScore,
                    durationMs: 500
                });
            });

            // Only start game loop if not disposed
            if (!this.isDisposed) {
                this.startGameLoop();
            }
        } catch (error) {
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    private startGameLoop(): void {
        this.lastTime = performance.now();
        this.isRunning = true;
        
        // Store the game loop function reference for cleanup
        this.gameLoopFn = (timestamp: number) => {
            // Early exit if disposed or not running
            if (!this.isRunning || !this.gameLoopFn) {
                return;
            }

            const deltaTime = timestamp - this.lastTime;
            this.lastTime = timestamp;

            try {
                // Update all systems
                this.gameState.update(deltaTime);
                
                // Only update physics if game is not paused
                const isPaused = this.gameState.isPaused();
                if (!isPaused) {
                    this.physicsSystem.update(deltaTime);
                } else {
                    // Physics paused - skipping physics update
                }
                
                this.renderEngine.update(deltaTime);
                this.uiManager.update(deltaTime);

                // Render
                this.renderEngine.render();
                this.uiManager.render();

            } catch (error) {
                // Error in game loop
                // Stop the loop on error to prevent infinite error spam
                this.stopGameLoop();
                return;
            }

            // Schedule next frame only if still running and not disposed
            if (this.isRunning && this.gameLoopFn && this.animationFrameId !== null) {
                this.animationFrameId = requestAnimationFrame(this.gameLoopFn);
            }
        };

        // Start the loop
        this.animationFrameId = requestAnimationFrame(this.gameLoopFn);
    }
    
    private stopGameLoop(): void {
        this.isRunning = false;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Clear the function reference to prevent memory leaks
        this.gameLoopFn = null;
    }

    // =====================================
    // PUBLIC API METHODS
    // =====================================
    
    // AI difficulty is now always set to hard

    /**
     * Get current game mode information
     */
    public getGameMode(): any {
        return this.gameState.getGameMode();
    }

    public getCurrentStateName(): string | null {
        return this.gameState.getCurrentStateName();
    }

    public onStateChange(callback: (stateName: string) => void): void {
        this.gameState.onStateChange(callback);
    }

    /**
     * Get current tournament information (if in tournament mode)
     */
    public getCurrentTournament(): any {
        const gameMode = this.gameState.getGameMode();
        if (gameMode.type === 'tournament' && gameMode.tournamentId) {
            return this.tournamentManager.getTournament(gameMode.tournamentId);
        }
        return null;
    }

    /**
     * Get AI statistics for display
     */
    public getAIStats(): any {
        return this.aiPlayer.getAIStats();
    }

    /**
     * Force navigate to a specific game state
     */
    public async navigateToState(stateName: string, data?: any): Promise<void> {
        await this.gameState.setState(stateName, data);
    }

    /**
     * Start a new local multiplayer game - goes through setup state first
     */
    public async startLocalGame(player1Name?: string, player2Name?: string): Promise<void> {
        // Create game session for local game
        await this.createGameSession('local');
        
        // If names are provided, skip setup and go directly to playing
        if (player1Name && player2Name) {
            this.gameState.setGameMode({
                type: 'local',
                player1Name,
                player2Name
            });
            await this.gameState.setState('playing');
        } else {
            // Go through setup state to get player names
            await this.gameState.setState('gameSetup', { type: 'local' });
        }
    }

    /**
     * Start a new AI game (always on hard difficulty) - goes through setup state first
     */
    public async startAIGame(playerName?: string): Promise<void> {
        // Set AI to hard difficulty
        this.aiPlayer.setDifficulty('hard');
        
        // Create game session for AI game
        await this.createGameSession('ai');
        
        // If player name is provided, skip setup and go directly to playing
        if (playerName) {
            this.gameState.setGameMode({
                type: 'ai',
                player1Name: playerName,
                player2Name: "AI Opponent"
            });
            await this.gameState.setState('playing');
        } else {
            // Go through setup state to get player name
            await this.gameState.setState('gameSetup', { type: 'ai' });
        }
    }

    /**
     * Start a new tournament
     */
    public async startTournament(playerNames: string[]): Promise<void> {
        const tournament = this.tournamentManager.createTournament(playerNames);
        this.gameState.setGameMode({
            type: 'tournament',
            tournamentId: tournament.id
        });
        
        // Show bracket briefly, then start first match
        this.uiManager.showTournamentBracket(tournament);
        
        setTimeout(async () => {
            const firstMatch = this.tournamentManager.getNextMatch(tournament.id);
            if (firstMatch) {
                await this.gameState.setState('playing', {
                    player1: firstMatch.player1,
                    player2: firstMatch.player2,
                    matchId: firstMatch.id
                });
            }
        }, 3000);
    }

    /**
     * Pause the current game
     */
    public pauseGame(): void {
        this.gameState.setState('paused');
    }

    /**
     * Resume the current game
     */
    public resumeGame(): void {
        this.gameState.setState('playing');
    }

    /**
     * Return to main menu
     */
    public returnToMenu(): void {
        this.scoreManager.reset();
        this.gameState.setState('menu');
    }

    /**
     * Get current game score
     */
    public getScore(): { left: number; right: number } {
        return this.scoreManager.getScore();
    }

    /**
     * Check if game is currently running
     */
    public isGameRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics(): {
        fps: number;
        renderTime: number;
        physicsTime: number;
    } {
        return {
            fps: Math.round(1000 / (this.lastTime - (this.lastTime - 16.67))),
            renderTime: 0, // Would need to implement timing
            physicsTime: 0 // Would need to implement timing
        };
    }

    // =====================================
    // INTEGRATION WITH BACKEND
    // =====================================
    
    /**
     * Initialize game session with backend
     */
    public async initializeGameSession(gameMode: 'local' | 'ai' | 'remote' | 'tournament', player2Id?: string, existingSessionId?: string): Promise<void> {
        try {
            let response: Response;
            
            if (existingSessionId) {
                // Fetch existing session (for remote games from invitations)
                // Fetching existing game session
                response = await fetch(`/api/game/session/${existingSessionId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
            } else {
                // Create new session (for local/AI games)
                // Creating new game session
                response = await fetch('/api/game/session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        game_mode: gameMode,
                        player2_id: player2Id
                    })
                });
            }

            if (!response.ok) {
                const errorText = await response.text();
                // Game service not available, playing offline mode
                return;
            }

            const text = await response.text();
            if (!text.trim()) {
                // Empty response from game service, playing offline mode
                return;
            }

            const data = JSON.parse(text);
            // Game session response received
            // Store session ID for later use
            this.currentGameSessionId = data.game_session?.id || null;
            
        } catch (error) {
            // Game service connection failed, playing offline mode
        }
    }

    /**
     * Update game session with score/results
     */
    public async updateGameSession(score: { left: number; right: number }, winner?: string): Promise<void> {
        if (!this.currentGameSessionId) return;

        try {
            const response = await fetch(`/api/game/session/${this.currentGameSessionId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    player1_score: score.left,
                    player2_score: score.right,
                    winner_id: winner,
                    status: winner ? 'finished' : 'active',
                    finished_at: winner ? new Date().toISOString() : null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update game session');
            }

            // Game session updated
            
        } catch (error) {
            // Failed to update game session
        }
    }

    /**
     * Send game event to backend for analytics
     */
    public async recordGameEvent(eventType: string, data: any): Promise<void> {
        if (!this.currentGameSessionId) return;

        try {
            await fetch(`/api/game/session/${this.currentGameSessionId}/event`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    event_type: eventType,
                    ...data
                })
            });
        } catch (error) {
            // Failed to record game event
        }
    }

    // =====================================
    // DISPOSE METHOD
    // =====================================
    public dispose(): void {
        if (this.isDisposed) {
            return; // Already disposed
        }
        
        this.isDisposed = true;
        
        
        // Stop render loop first to prevent any further frame requests
        this.stopGameLoop();

        try {
            // Stop AI
            if (this.aiPlayer) {
                this.aiPlayer.stop();
            }
            
            // Dispose all systems with null checks
            if (this.renderEngine) {
                this.renderEngine.dispose();
            }
            if (this.inputManager) {
                this.inputManager.dispose();
            }
            if (this.physicsSystem) {
                this.physicsSystem.dispose();
            }
            if (this.audioManager) {
                this.audioManager.dispose();
            }
            if (this.uiManager) {
                this.uiManager.dispose();
            }
            
            // Dispose GameStateManager to stop timers and cleanup
            if (this.gameState && typeof (this.gameState as any).dispose === 'function') {
                (this.gameState as any).dispose();
            }
            
        } catch (error) {
            console.warn('Error during PongManager disposal:', error);
        }
    }

    // =====================================
    // REMOTE MULTIPLAYER SYNC METHODS
    // =====================================
    
    /**
     * Set camera perspective for multiplayer game
     */
    public setPlayerCameraPerspective(): void {
        if (this.renderEngine) {
            this.renderEngine.setCameraForPlayer();
        }
    }

    /**
     * Play audio for remote games
     */
    public playAudio(audioType: 'wall_bounce' | 'paddle_hit' | 'score'): void {
        if (this.renderEngine) {
            switch (audioType) {
                case 'wall_bounce':
                    this.renderEngine.playBallWallBounceSound();
                    break;
                case 'paddle_hit':
                    this.renderEngine.playBallHitSound();
                    break;
                case 'score':
                    this.renderEngine.playScoreSound();
                    break;
            }
        }
    }
    
    /**
     * Sync backend game state to frontend 3D engine for remote multiplayer
     */
    public syncRemoteGameState(ball: any, paddle1: any, paddle2: any): void {
        try {
            // Sync paddle positions received from backend
            
            // Update ball position and velocity in render engine
            if (this.renderEngine && ball) {
                this.renderEngine.updateBallPosition(ball.x, ball.y, ball.vx, ball.vy);
            }
            
            // Update paddle positions in render engine  
            if (this.renderEngine && paddle1 && paddle2) {
                // Updating 3D paddle positions
                this.renderEngine.updatePaddlePositions(paddle1.y, paddle2.y);
            }
            
            // Update physics system state to match backend
            if (this.physicsSystem && ball) {
                this.physicsSystem.syncRemoteState(ball, paddle1, paddle2);
            }
            
        } catch (error) {
            // Error syncing remote game state
        }
    }
    
    // =====================================
    // DEBUG METHODS
    // =====================================
    
    /**
     * Enable debug mode with additional logging and overlays
     */
    public enableDebugMode(): void {
        // Debug mode enabled
        // Add debug overlays, performance monitors, etc.
    }

    /**
     * Get debug information
     */
    public getDebugInfo(): any {
        return {
            gameState: this.gameState,
            currentMode: this.getGameMode(),
            score: this.getScore(),
            aiStats: this.getAIStats(),
            performance: this.getPerformanceMetrics(),
            tournament: this.getCurrentTournament()
        };
    }

    // =====================================
    // GAME SESSION MANAGEMENT
    // =====================================
    
    /**
     * Create a game session for tracking results
     */
    public async createGameSession(gameMode: 'local' | 'ai' | 'remote' | 'tournament', player2Id?: string): Promise<void> {
        this.currentGameMode = gameMode;
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                // No auth token, skipping game session creation
                return;
            }

            const response = await fetch('/api/game/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    game_mode: gameMode,
                    player2_id: gameMode === 'ai' ? 'AI' : (player2Id || null)
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.currentGameSessionId = data.game_session?.id || null;
                // Game session created
            } else {
                // Failed to create game session
            }
        } catch (error) {
            // Game service connection failed
        }
    }
}