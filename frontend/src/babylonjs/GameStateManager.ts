import { RenderEngine } from "./RenderEngine";
import { InputManager } from "./InputManager";
import { PhysicsSystem } from "./PhysicsSystem";
import { UIManager } from "./UIManager";
import { ScoreManager } from "./ScoreManager";
import { AudioManager } from "./AudioManager";
import { AIPlayer } from "./AIPlayer";
import { TournamentManager } from "./TournamentManager";

// =====================================
// ENHANCED GAME STATE MANAGER
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

    constructor(systems: Omit<SystemReferences, 'aiPlayer' | 'tournamentManager'>, pongManager?: any) {
        this.pongManager = pongManager;
        
        // Initialize AI and Tournament systems
        const aiPlayer = new AIPlayer(systems.physicsSystem, systems.renderEngine);
        const tournamentManager = new TournamentManager();
        
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
            console.log(`🎮 State changed to: ${stateName}`);
        }
    }

    setGameMode(mode: GameMode): void {
        this.currentGameMode = mode;
        console.log('🎮 Game mode set:', mode);
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

    getState(stateName: string): GameState | undefined {
        return this.states.get(stateName);
    }

    getAIPlayer(): AIPlayer {
        return this.systems.aiPlayer;
    }

    getTournamentManager(): TournamentManager {
        return this.systems.tournamentManager;
    }

    isPaused(): boolean {
        return this.paused;
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
        console.log("📋 Entered Menu State");
        this.systems.uiManager.showMainMenu({
            onLocalGame: () => this.stateManager.setState('gameSetup', { type: 'local' }),
            onAIGame: () => this.stateManager.setState('gameSetup', { type: 'ai' }),
            onTournament: () => {
                console.log("🏆 Navigating to new tournament setup page");
                const event = new CustomEvent('navigate', {
                    detail: { path: '/game/tournament/setup' }
                });
                window.dispatchEvent(event);
            },
            onExitToDashboard: () => {
                console.log("🚪 Exit to Dashboard clicked");
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
        console.log("⚙️ Entered Game Setup State");
        
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
    private matchData: any = null;

    setResumingFromPause(resuming: boolean): void {
        this.isResumingFromPause = resuming;
    }

    async enter(data?: any): Promise<void> {
        console.log("🎮 Entered Playing State");
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
        const winningScore = 11; // Configurable
        
        if (score.left >= winningScore || score.right >= winningScore) {
            this.handleGameEnd();
        }
    }

    private async countdown(): Promise<void> {
        return new Promise((resolve) => {
            this.countdownActive = true;
            let count = 3;
            
            const tick = () => {
                if (!this.countdownActive) return;
                
                this.systems.uiManager.showCountdown(count);
                
                if (count <= 0) {
                    this.systems.uiManager.clearCountdown();
                    this.countdownActive = false;
                    resolve();
                } else {
                    count--;
                    setTimeout(tick, 1000);
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

        this.systems.inputManager.registerHandler('escape', (pressed) => {
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
        
        if (gameMode.type === 'tournament' && gameMode.tournamentId) {
            // Handle tournament match end
            const tournament = this.systems.tournamentManager.getTournament(gameMode.tournamentId);
            if (tournament && this.matchData) {
                const winnerName = winner === 'left' ? 
                    this.matchData.player1.name : this.matchData.player2.name;
                
                this.systems.tournamentManager.completeMatch(
                    gameMode.tournamentId, 
                    this.matchData.matchId, 
                    winnerName
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
        this.systems.inputManager.unregisterHandler('escape');
    }
}

// =====================================
// PAUSED STATE
// =====================================
class PausedState extends GameState {
    enter(): void {
        console.log("⏸️ Entered Paused State");
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

        this.systems.inputManager.registerHandler('escape', (pressed) => {
            if (pressed) {
                this.systems.scoreManager.reset();
                // Navigate back to dashboard
                const event = new CustomEvent('navigate', {
                    detail: { path: '/dashboard' }
                });
                window.dispatchEvent(event);
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
        console.log("▶️ Exiting Paused State");
        (this.stateManager as any).paused = false;
        this.systems.uiManager.hidePause();
        this.systems.inputManager.unregisterHandler(' ');
        this.systems.inputManager.unregisterHandler('escape');
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
        console.log("🏁 Entered Game Over State");
        
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

        this.systems.inputManager.registerHandler('escape', (pressed) => {
            if (pressed) {
                this.systems.scoreManager.reset();
                this.stateManager.setState('menu');
            }
        });
    }

    exit(): void {
        this.systems.uiManager.hideGameOver();
        this.systems.inputManager.unregisterHandler('r');
        this.systems.inputManager.unregisterHandler('escape');
    }

    update(deltaTime: number): void {}
}

// =====================================
// TOURNAMENT RESULTS STATE
// =====================================
class TournamentResultsState extends GameState {
    enter(data: { tournamentId: string, lastMatch: any, winner: string }): void {
        console.log("🏆 Entered Tournament Results State");
        
        const tournament = this.systems.tournamentManager.getTournament(data.tournamentId);
        if (!tournament) return;

        if (tournament.isComplete) {
            // Tournament is finished
            const champion = tournament.winner;
            if (champion) {
                this.systems.uiManager.showTournamentComplete({
                    tournament,
                    champion,
                    onNewTournament: () => {
                        console.log("🏆 Starting new tournament - navigating to setup page");
                        const event = new CustomEvent('navigate', {
                            detail: { path: '/game/tournament/setup' }
                        });
                        window.dispatchEvent(event);
                    },
                    onMainMenu: () => this.stateManager.setState('menu')
                });
            } else {
                // Fallback if no winner is determined
                console.error('Tournament completed but no winner found');
                this.stateManager.setState('menu');
            }
        } else {
            // Show match results and prepare for next match
            const nextMatch = this.systems.tournamentManager.getNextMatch(data.tournamentId);
            
            this.systems.uiManager.showMatchResults({
                winner: data.winner,
                nextMatch,
                tournament,
                onContinue: () => {
                    if (nextMatch) {
                        this.stateManager.setState('playing', {
                            player1: nextMatch.player1,
                            player2: nextMatch.player2,
                            matchId: nextMatch.id
                        });
                    }
                },
                onMainMenu: () => this.stateManager.setState('menu')
            });
        }
    }

    exit(): void {
        this.systems.uiManager.hideTournamentResults();
    }

    update(deltaTime: number): void {}
}