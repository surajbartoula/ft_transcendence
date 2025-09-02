import { RenderEngine } from "./RenderEngine";
import { InputManager } from "./InputManager";
import { PhysicsSystem } from "./PhysicsSystem";
import { UIManager } from "./UIManager";
import { ScoreManager } from "./ScoreManager";
import { AudioManager } from "./AudioManager";
import { AIPlayer } from "./AIPlayer";
import { TournamentManager } from "./TournamentManager";

// =====================================
// GAME STATE MANAGER
// =====================================
interface SystemReferences {
    renderEngine: RenderEngine; 
    inputManager: InputManager; 
    physicsSystem: PhysicsSystem;
    audioManager: AudioManager;
    uiManager: UIManager;
    scoreManager: ScoreManager;
    aiPlayer: AIPlayer;
    tournamentManager: TournamentManager;
}

interface GameMode {
    type: 'local' | 'ai' | 'tournament';
    player1Name?: string;
    player2Name?: string;
    tournamentId?: string;
}

export class GameStateManager {
    private currentState: GameState | null = null;
    private states: Map<string, GameState> = new Map();
    private systems: SystemReferences;
    private currentGameMode: GameMode = { type: 'local' };
    private pongManager: any = null; // Reference to PongManager
    private paused: boolean = false; // Simple pause flag
    private stateChangeCallbacks: ((stateName: string) => void)[] = [];

    constructor(systems: Omit<SystemReferences, 'aiPlayer' | 'tournamentManager'>, pongManager?: any) {
        this.pongManager = pongManager;
        
        // Initialize AI and get Tournament singleton instance
        const aiPlayer = new AIPlayer(systems.physicsSystem, systems.renderEngine);
        const tournamentManager = TournamentManager.getInstance(); // Use singleton pattern
        
        this.systems = {
            ...systems,
            aiPlayer,
            tournamentManager
        };
        
        this.initializeStates();
    }

    private initializeStates(): void {
        this.states.set('menu', new MenuState(this.systems, this));
        this.states.set('gameSetup', new GameSetupState(this.systems, this));
        this.states.set('playing', new PlayingState(this.systems, this));
        this.states.set('paused', new PausedState(this.systems, this));
        this.states.set('gameOver', new GameOverState(this.systems, this));
        this.states.set('tournamentResults', new TournamentResultsState(this.systems, this));
    }

    async setState(stateName: string, data?: any): Promise<void> {
        if (this.currentState) {
            this.currentState.exit();
        }

        const newState = this.states.get(stateName);
        if (newState) {
            this.currentState = newState;
            await this.currentState.enter(data);
            // State changed
            
            // Trigger state change callbacks
            this.stateChangeCallbacks.forEach(callback => {
                try {
                    callback(stateName);
                } catch (error) {
                    // State change callback error
                }
            });
        }
    }

    setGameMode(mode: GameMode): void {
        this.currentGameMode = mode;
        // Game mode set
    }

    getGameMode(): GameMode {
        return this.currentGameMode;
    }

    update(deltaTime: number): void {
        if (this.currentState) {
            this.currentState.update(deltaTime);
        }
        
        // Update AI if it's active
        if (this.currentGameMode.type === 'ai') {
            this.systems.aiPlayer.update(deltaTime);
        }
    }

    getCurrentStateName(): string | null {
        for (const [name, state] of this.states.entries()) {
            if (state === this.currentState) {
                return name;
            }
        }
        return null;
    }

    onStateChange(callback: (stateName: string) => void): void {
        this.stateChangeCallbacks.push(callback);
    }

    getState(stateName: string): GameState | undefined {
        return this.states.get(stateName);
    }

    getAIPlayer(): AIPlayer {
        return this.systems.aiPlayer;
    }

    getTournamentManager(): TournamentManager {
        return this.systems.tournamentManager;
    }

    /**
     * Update game session from a state (called by states that don't have direct access to pongManager)
     */
    public updateGameSessionFromState(score: { left: number; right: number }, winnerId: string | null): void {
        if (this.pongManager) {
            this.pongManager.updateGameSession(score, winnerId);
        }
    }

    /**
     * Get current user ID from JWT token
     */
    public getCurrentUserId(): string | null {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;
            
            // Decode JWT token to get user ID
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.sub || payload.user_id || payload.id || null;
        } catch (error) {
            // Failed to get user ID from token
            return null;
        }
    }

    isPaused(): boolean {
        return this.paused;
    }

    public dispose(): void {
        // GameStateManager disposing
        
        // Clear countdown timer if it exists in any state
        const states = Array.from(this.states.values());
        states.forEach(state => {
            if ((state as any).countdownTimer) {
                // Clearing countdown timer
                clearTimeout((state as any).countdownTimer);
                (state as any).countdownTimer = null;
            }
            if ((state as any).countdownActive) {
                (state as any).countdownActive = false;
            }
        });
        
        // Clear any countdown UI that might still be visible
        if (this.systems.uiManager) {
            this.systems.uiManager.clearCountdown();
        }
        
        // Also directly remove countdown from DOM
        const countdownEl = document.querySelector('[data-game-element="countdown"]');
        if (countdownEl) {
            // Removing countdown element
            countdownEl.remove();
        }
        
        // GameStateManager disposal complete
    }
}

// =====================================
// BASE GAME STATE
// =====================================
abstract class GameState {
    constructor(
        protected systems: SystemReferences,
        protected stateManager: GameStateManager
    ) {}

    abstract enter(data?: any): void | Promise<void>;
    abstract exit(): void;
    abstract update(deltaTime: number): void;
}

// =====================================
// MENU STATE
// =====================================
class MenuState extends GameState {
    enter(): void {
        // Entered Menu State
        this.systems.uiManager.showMainMenu({
            onLocalGame: () => this.stateManager.setState('gameSetup', { type: 'local' }),
            onAIGame: () => this.stateManager.setState('gameSetup', { type: 'ai' }),
            onTournament: () => {
                // Navigating to tournament setup
                const event = new CustomEvent('navigate', {
                    detail: { path: '/game/tournament/setup' }
                });
                window.dispatchEvent(event);
            },
            onExitToDashboard: () => {
                // Exit to Dashboard clicked
                const event = new CustomEvent('navigate', {
                    detail: { path: '/dashboard' }
                });
                window.dispatchEvent(event);
            }
        });
    }

    exit(): void {
        this.systems.uiManager.hideMainMenu();
    }

    update(deltaTime: number): void {}
}

// =====================================
// GAME SETUP STATE
// =====================================
class GameSetupState extends GameState {
    enter(data: { type: 'local' | 'ai' }): void {
        // Entered Game Setup State
        
        if (data.type === 'local') {
            this.systems.uiManager.showPlayerSetup({
                title: "Local Multiplayer Setup",
                players: [
                    { label: "Player 1 Name", placeholder: "Enter Player 1 name", defaultValue: "Player 1" },
                    { label: "Player 2 Name", placeholder: "Enter Player 2 name", defaultValue: "Player 2" }
                ],
                onStart: (playerNames) => {
                    this.stateManager.setGameMode({
                        type: 'local',
                        player1Name: playerNames[0],
                        player2Name: playerNames[1]
                    });
                    this.stateManager.setState('playing');
                },
                onBack: () => this.stateManager.setState('menu')
            });
        } else if (data.type === 'ai') {
            this.systems.uiManager.showPlayerSetup({
                title: "Play Against AI",
                players: [
                    { label: "Your Name", placeholder: "Enter your name", defaultValue: "Player" }
                ],
                onStart: (playerNames) => {
                    this.stateManager.setGameMode({
                        type: 'ai',
                        player1Name: playerNames[0],
                        player2Name: "AI Opponent"
                    });
                    this.stateManager.setState('playing');
                },
                onBack: () => this.stateManager.setState('menu')
            });
        }
    }

    exit(): void {
        this.systems.uiManager.hidePlayerSetup();
    }

    update(deltaTime: number): void {}
}


// =====================================
// PLAYING STATE
// =====================================
class PlayingState extends GameState {
    private isResumingFromPause: boolean = false;
    private countdownActive: boolean = false;
    private countdownTimer: NodeJS.Timeout | null = null;
    private matchData: any = null;

    setResumingFromPause(resuming: boolean): void {
        this.isResumingFromPause = resuming;
    }

    async enter(data?: any): Promise<void> {
        // Entered Playing State
        this.matchData = data;
        
        // Set up physics system
        this.systems.physicsSystem.setRenderEngine(this.systems.renderEngine);
        this.systems.physicsSystem.setScoreManager(this.systems.scoreManager);
        
        // Initialize AI if needed
        const gameMode = this.stateManager.getGameMode();
        if (gameMode.type === 'ai') {
            this.systems.aiPlayer.initialize();
        }
        
        // Show game UI
        this.systems.uiManager.showGameUI({
            player1Name: gameMode.player1Name || "Player 1",
            player2Name: gameMode.player2Name || "Player 2",
            gameMode: gameMode.type
        });

        if (this.isResumingFromPause) {
            this.systems.physicsSystem.resumeBall();
        } else {
            await this.countdown();
            this.systems.physicsSystem.startBall();
        }
        
        this.setupInputHandlers();
        this.isResumingFromPause = false;
    }

    exit(): void {
        this.cleanupInputHandlers();
        this.systems.physicsSystem.stopBall();
        this.systems.uiManager.hideGameUI();
        
        // Stop AI if active
        if (this.stateManager.getGameMode().type === 'ai') {
            this.systems.aiPlayer.stop();
        }
    }

    update(deltaTime: number): void {
        this.updatePaddleMovement(deltaTime);
        
        // Check for game end conditions
        const score = this.systems.scoreManager.getScore();
        const winningScore = 7; // Configurable
        
        if (score.left >= winningScore || score.right >= winningScore) {
            this.handleGameEnd();
        }
    }

    private async countdown(): Promise<void> {
        return new Promise((resolve) => {
            this.countdownActive = true;
            let count = 3;
            
            const tick = () => {
                if (!this.countdownActive) {
                    // Countdown cancelled
                    resolve();
                    return;
                }
                
                this.systems.uiManager.showCountdown(count);
                
                if (count <= 0) {
                    this.systems.uiManager.clearCountdown();
                    this.countdownActive = false;
                    this.countdownTimer = null;
                    resolve();
                } else {
                    count--;
                    this.countdownTimer = setTimeout(tick, 1000);
                }
            };
            
            tick();
        });
    }

    private setupInputHandlers(): void {
        this.systems.inputManager.registerHandler(' ', (pressed) => {
            if (pressed) {
                this.stateManager.setState('paused');
            }
        });


    }

    private updatePaddleMovement(deltaTime: number): void {
        const gameMode = this.stateManager.getGameMode();
        
        // Left paddle movement (Player 1)
        let leftInput = 0;
        if (this.systems.inputManager.isKeyPressed('arrowup')) leftInput += 1;
        if (this.systems.inputManager.isKeyPressed('arrowdown')) leftInput -= 1;

        if (leftInput !== 0) {
            this.systems.physicsSystem.updatePaddlePosition('paddleLeft', leftInput, deltaTime);
        }

        // Right paddle movement (Player 2 or AI)
        if (gameMode.type === 'ai') {
            // AI controls right paddle
            const aiInput = this.systems.aiPlayer.getInput();
            if (aiInput !== 0) {
                this.systems.physicsSystem.updatePaddlePosition('paddleRight', aiInput, deltaTime);
            }
        } else {
            // Human controls right paddle
            let rightInput = 0;
            if (this.systems.inputManager.isKeyPressed('w')) rightInput += 1;
            if (this.systems.inputManager.isKeyPressed('s')) rightInput -= 1;
            
            if (rightInput !== 0) {
                this.systems.physicsSystem.updatePaddlePosition('paddleRight', rightInput, deltaTime);
            }
        }
    }

    private handleGameEnd(): void {
        const score = this.systems.scoreManager.getScore();
        const winner = score.left > score.right ? 'left' : 'right';
        const gameMode = this.stateManager.getGameMode();
        
        // Update game session with results (for AI, local games)
        if ((gameMode.type === 'ai' || gameMode.type === 'local')) {
            // Get current user ID to determine if they won
            const userId = this.stateManager.getCurrentUserId();
            let winnerId: string | null = null;
            
            if (gameMode.type === 'ai') {
                // For AI games, display is swapped: AI is shown on left, player on right
                winnerId = winner === 'right' ? userId : 'AI'; // 'AI' when AI (left) wins
            } else if (gameMode.type === 'local') {
                // For local games, we can't determine the specific user, so just pass null
                winnerId = null;
            }
            
            // Game ended
            
            // Update the game session with results through the state manager
            this.stateManager.updateGameSessionFromState(score, winnerId);
        }
        
        if (gameMode.type === 'tournament' && gameMode.tournamentId) {
            // Handle tournament match end
            const tournament = this.systems.tournamentManager.getTournament(gameMode.tournamentId);
            
            if (tournament && this.matchData) {
                const winnerName = winner === 'left' ? 
                    this.matchData.player1.name : this.matchData.player2.name;
                
                this.systems.tournamentManager.completeMatch(
                    gameMode.tournamentId, 
                    this.matchData.matchId, 
                    winnerName,
                    { player1: score.left, player2: score.right }
                );
                
                this.stateManager.setState('tournamentResults', {
                    tournamentId: gameMode.tournamentId,
                    lastMatch: this.matchData,
                    winner: winnerName
                });
            }
        } else {
            // Regular game end
            this.stateManager.setState('gameOver', {
                winner,
                score,
                gameMode
            });
        }
    }

    private cleanupInputHandlers(): void {
        this.systems.inputManager.unregisterHandler(' ');
    }
}

// =====================================
// PAUSED STATE
// =====================================
class PausedState extends GameState {
    enter(): void {
        // Entered Paused State
        (this.stateManager as any).paused = true;
        this.systems.uiManager.showPause({
            onResume: () => {
                const playingState = this.stateManager.getState('playing') as PlayingState;
                if (playingState) playingState.setResumingFromPause(true);
                this.stateManager.setState('playing', this.getCurrentMatchData());
            },
            onRestart: () => {
                this.systems.scoreManager.reset();
                this.systems.physicsSystem.stopBall();
                const playingState = this.stateManager.getState('playing') as PlayingState;
                if (playingState) playingState.setResumingFromPause(false);
                this.stateManager.setState('playing', this.getCurrentMatchData());
            },
            onMainMenu: () => {
                this.systems.scoreManager.reset();
                this.stateManager.setState('menu');
            },
            onQuitToDashboard: () => {
                this.systems.scoreManager.reset();
                // Navigate back to dashboard
                const event = new CustomEvent('navigate', {
                    detail: { path: '/dashboard' }
                });
                window.dispatchEvent(event);
            }
        });

        // Keyboard shortcuts
        this.systems.inputManager.registerHandler(' ', (pressed) => {
            if (pressed) {
                const playingState = this.stateManager.getState('playing') as PlayingState;
                if (playingState) playingState.setResumingFromPause(true);
                this.stateManager.setState('playing');
            }
        });



        this.systems.inputManager.registerHandler('r', (pressed) => {
            if (pressed) {
                this.systems.scoreManager.reset();
                this.systems.physicsSystem.stopBall();
                const playingState = this.stateManager.getState('playing') as PlayingState;
                if (playingState) playingState.setResumingFromPause(false);
                this.stateManager.setState('playing', this.getCurrentMatchData());
            }
        });

        this.systems.inputManager.registerHandler('q', (pressed) => {
            if (pressed) {
                this.systems.scoreManager.reset();
                // Navigate back to dashboard
                const event = new CustomEvent('navigate', {
                    detail: { path: '/dashboard' }
                });
                window.dispatchEvent(event);
            }
        });
    }

    exit(): void {
        // Exiting Paused State
        (this.stateManager as any).paused = false;
        this.systems.uiManager.hidePause();
        this.systems.inputManager.unregisterHandler(' ');
        this.systems.inputManager.unregisterHandler('r');
        this.systems.inputManager.unregisterHandler('q');
    }

    update(deltaTime: number): void {}

    private getCurrentMatchData(): any {
        // Return current match data if in tournament mode
        const gameMode = this.stateManager.getGameMode();
        if (gameMode.type === 'tournament' && gameMode.tournamentId) {
            const tournament = this.systems.tournamentManager.getTournament(gameMode.tournamentId);
            return this.systems.tournamentManager.getCurrentMatch(gameMode.tournamentId);
        }
        return null;
    }
}

// =====================================
// GAME OVER STATE
// =====================================
class GameOverState extends GameState {
    enter(data: { winner: string, score: any, gameMode: GameMode }): void {
        // Entered Game Over State
        
        this.systems.uiManager.showGameOver({
            winner: data.winner,
            score: data.score,
            gameMode: data.gameMode,
            onPlayAgain: () => {
                this.systems.scoreManager.reset();
                this.stateManager.setState('playing');
            },
            onMainMenu: () => {
                this.systems.scoreManager.reset();
                this.stateManager.setState('menu');
            }
        });

        this.systems.inputManager.registerHandler('r', (pressed) => {
            if (pressed) {
                this.systems.scoreManager.reset();
                this.stateManager.setState('playing');
            }
        });


    }

    exit(): void {
        this.systems.uiManager.hideGameOver();
        this.systems.inputManager.unregisterHandler('r');
    }

    update(deltaTime: number): void {}
}

// =====================================
// TOURNAMENT RESULTS STATE
// =====================================
class TournamentResultsState extends GameState {
    private celebrationTimer: NodeJS.Timeout | null = null;

    enter(data: { tournamentId: string, lastMatch: any, winner: string }): void {
        
        const tournament = this.systems.tournamentManager.getTournament(data.tournamentId);
        if (!tournament) return;

        // Show tournament-specific match results screen
        const winnerDisplayName = data.winner;
        
        // Find the next match in the tournament
        const nextMatch = this.findNextMatch(tournament);
        
        this.systems.uiManager.showMatchResults({
            winner: winnerDisplayName,
            nextMatch: nextMatch,
            tournament: tournament,
            onContinue: () => this.navigateToTournamentBracket(tournament, data),
            onMainMenu: () => this.navigateToTournamentBracket(tournament, data) // Keep them in tournament flow
        });

        // Auto-continue after showing celebration
        this.celebrationTimer = setTimeout(() => {
            this.navigateToTournamentBracket(tournament, data);
        }, 3000);
    }

    private findNextMatch(tournament: any): any {
        // Find the next incomplete match in the tournament
        for (const match of tournament.matches) {
            if (!match.isComplete && match.player1 && match.player2) {
                return match;
            }
        }
        return null;
    }

    private navigateToTournamentBracket(tournament: any, data: { tournamentId: string, lastMatch: any, winner: string }): void {
        if (this.celebrationTimer) {
            clearTimeout(this.celebrationTimer);
            this.celebrationTimer = null;
        }

        // Hide tournament results screen
        this.systems.uiManager.hideTournamentResults();

        // Navigate back to tournament bracket with updated tournament state
        const playersParam = encodeURIComponent(JSON.stringify(tournament.players.map((p: any) => p.name)));
        const navigationPath = `/game/tournament/bracket?players=${playersParam}&name=${encodeURIComponent(tournament.name || 'Tournament')}`;
        
        const event = new CustomEvent('navigate', {
            detail: { path: navigationPath }
        });
        window.dispatchEvent(event);
    }

    exit(): void {
        if (this.celebrationTimer) {
            clearTimeout(this.celebrationTimer);
            this.celebrationTimer = null;
        }
        this.systems.uiManager.hideTournamentResults();
        this.systems.uiManager.hideGameOver();
    }

    update(deltaTime: number): void {}
}