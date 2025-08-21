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
// ENHANCED PONG GAME MANAGER
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

    constructor(canvas: HTMLCanvasElement) {
        console.log("🎮 Initializing Enhanced Pong Game Manager...");
        
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
        console.log("🎮 Initializing Enhanced Pong Game Systems...");

        try {
            // Initialize all systems in proper order
            await this.renderEngine.initialize();
            this.inputManager.initialize();
            this.physicsSystem.initialize();
            this.audioManager.initialize();
            this.uiManager.initialize();
            this.scoreManager.initialize();

            // Set up score change callback with enhanced UI features
            this.scoreManager.setScoreChangeCallback(({ leftScore, rightScore, scorer }) => {
                this.uiManager.showScoreFlash({ 
                    scorer, 
                    leftScore, 
                    rightScore,
                    durationMs: 2000
                });
            });

            this.startGameLoop();

            console.log("✅ Enhanced Game Manager initialized successfully!");
            
        } catch (error) {
            console.error("❌ Failed to initialize game systems:", error);
            throw error;
        }
    }

    private startGameLoop(): void {
        this.isRunning = true;
        
        const gameLoop = (timestamp: number) => {
            if (!this.isRunning) return;

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
                    // Only log once every 60 frames to avoid spam
                    if (Math.floor(timestamp / 1000) % 1 < 0.02) {
                        console.log('🎯 Physics paused - skipping physics update');
                    }
                }
                
                this.renderEngine.update(deltaTime);
                this.uiManager.update(deltaTime);

                // Render
                this.renderEngine.render();
                this.uiManager.render();

            } catch (error) {
                console.error("❌ Error in game loop:", error);
            }

            requestAnimationFrame(gameLoop);
        };

        requestAnimationFrame(gameLoop);
        console.log("🔄 Enhanced game loop started");
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
     * Start a new local multiplayer game
     */
    public async startLocalGame(player1Name: string = "Player 1", player2Name: string = "Player 2"): Promise<void> {
        this.gameState.setGameMode({
            type: 'local',
            player1Name,
            player2Name
        });
        await this.gameState.setState('playing');
    }

    /**
     * Start a new AI game (always on hard difficulty)
     */
    public async startAIGame(playerName: string = "Player"): Promise<void> {
        // Set AI to hard difficulty
        this.aiPlayer.setDifficulty('hard');
        this.gameState.setGameMode({
            type: 'ai',
            player1Name: playerName,
            player2Name: "AI Opponent"
        });
        await this.gameState.setState('playing');
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
        console.log('🎯 PongManager.pauseGame() called');
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
        // Basic performance tracking - could be enhanced
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
                console.log(`🔄 Fetching existing game session: ${existingSessionId}`);
                response = await fetch(`https://localhost:3004/api/game/session/${existingSessionId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
            } else {
                // Create new session (for local/AI games)
                console.log(`🆕 Creating new game session - Mode: ${gameMode}, Player2: ${player2Id}`);
                response = await fetch('https://localhost:3004/api/game/session', {
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
                console.error(`❌ Game session API error (${response.status}):`, errorText);
                console.warn('⚠️ Game service not available, playing offline mode');
                return;
            }

            const text = await response.text();
            if (!text.trim()) {
                console.warn('⚠️ Empty response from game service, playing offline mode');
                return;
            }

            const data = JSON.parse(text);
            console.log('✅ Game session response:', data);
            // Store session ID for later use
            this.currentGameSessionId = data.game_session?.id || null;
            
        } catch (error) {
            console.warn('⚠️ Game service connection failed, playing offline mode:', error);
        }
    }

    private currentGameSessionId: string | null = null;

    /**
     * Update game session with score/results
     */
    public async updateGameSession(score: { left: number; right: number }, winner?: string): Promise<void> {
        if (!this.currentGameSessionId) return;

        try {
            const response = await fetch(`https://localhost:3004/api/game/session/${this.currentGameSessionId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    player1_score: score.left,
                    player2_score: score.right,
                    winner_id: winner,
                    status: winner ? 'finished' : 'active'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update game session');
            }

            console.log('🎮 Game session updated');
            
        } catch (error) {
            console.error('❌ Failed to update game session:', error);
        }
    }

    /**
     * Send game event to backend for analytics
     */
    public async recordGameEvent(eventType: string, data: any): Promise<void> {
        if (!this.currentGameSessionId) return;

        try {
            await fetch(`https://localhost:3004/api/game/session/${this.currentGameSessionId}/event`, {
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
            console.warn('⚠️ Failed to record game event:', error);
        }
    }

    // =====================================
    // ENHANCED DISPOSE METHOD
    // =====================================
    public dispose(): void {
        console.log("🎮 Disposing Enhanced Pong Game Manager...");
        
        this.isRunning = false;

        try {
            // Stop AI
            this.aiPlayer.stop();
            
            // Dispose all systems
            this.renderEngine.dispose();
            this.inputManager.dispose();
            this.physicsSystem.dispose();
            this.audioManager.dispose();
            this.uiManager.dispose();
            
            // Clear any remaining timers or intervals
            // (GameStateManager handles its own cleanup)
            
            console.log("✅ Enhanced Game Manager disposed successfully");
            
        } catch (error) {
            console.warn("⚠️ Error during disposal:", error);
        }
    }

    // =====================================
    // REMOTE MULTIPLAYER SYNC METHODS
    // =====================================
    
    /**
     * Set camera perspective for multiplayer game
     */
    public setPlayerCameraPerspective(isPlayer1: boolean): void {
        if (this.renderEngine) {
            this.renderEngine.setCameraForPlayer(isPlayer1);
        }
    }
    
    /**
     * Sync backend game state to frontend 3D engine for remote multiplayer
     */
    public syncRemoteGameState(ball: any, paddle1: any, paddle2: any): void {
        try {
            // Debug paddle positions received from backend
            console.log(`🔄 SYNC: Received paddle positions - P1 Y: ${paddle1?.y}, P2 Y: ${paddle2?.y}`);
            
            // Update ball position and velocity in render engine
            if (this.renderEngine && ball) {
                this.renderEngine.updateBallPosition(ball.x, ball.y, ball.vx, ball.vy);
            }
            
            // Update paddle positions in render engine  
            if (this.renderEngine && paddle1 && paddle2) {
                console.log(`🔄 SYNC: Updating 3D paddle positions - Left paddle (P1): ${paddle1.y}, Right paddle (P2): ${paddle2.y}`);
                this.renderEngine.updatePaddlePositions(paddle1.y, paddle2.y);
            }
            
            // Update physics system state to match backend
            if (this.physicsSystem && ball) {
                this.physicsSystem.syncRemoteState(ball, paddle1, paddle2);
            }
            
        } catch (error) {
            console.warn('⚠️ Error syncing remote game state:', error);
        }
    }
    
    // =====================================
    // DEBUG METHODS
    // =====================================
    
    /**
     * Enable debug mode with additional logging and overlays
     */
    public enableDebugMode(): void {
        console.log("🐛 Debug mode enabled");
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
}