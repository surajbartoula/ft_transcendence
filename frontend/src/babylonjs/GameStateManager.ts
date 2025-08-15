import { RenderEngine } from "./RenderEngine";
import { InputManager } from "./InputManager";
import { PhysicsSystem } from "./PhysicsSystem";
import { UIManager } from "./UIManager";
import { ScoreManager } from "./ScoreManager";
import { AudioManager } from "./AudioManager";

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
}

export class GameStateManager {
    private currentState: GameState | null = null;
    private states: Map<string, GameState> = new Map();
    private systems: SystemReferences;

    constructor(systems: SystemReferences) {
        this.systems = systems;
        this.initializeStates();
    }

    private initializeStates(): void {
        this.states.set('menu', new MenuState(this.systems, this));
        this.states.set('loading', new LoadingState(this.systems, this));
        this.states.set('playing', new PlayingState(this.systems, this));
        this.states.set('paused', new PausedState(this.systems, this));
        this.states.set('gameOver', new GameOverState(this.systems, this));
    }

    async setState(stateName: string): Promise<void> {
        if (this.currentState) {
            this.currentState.exit();
        }

        const newState = this.states.get(stateName);
        if (newState) {
            this.currentState = newState;
            await this.currentState.enter();
            console.log(`🎮 State changed to: ${stateName}`);
        }
    }

    update(deltaTime: number): void {
        if (this.currentState) {
            this.currentState.update(deltaTime);
        }
    }

    getState(stateName: string): GameState | undefined {
        return this.states.get(stateName);
    }
}

// =====================================
// GAME STATES
//
// Abstract classes
// =====================================
abstract class GameState {
    constructor(
        protected systems: SystemReferences,
        protected stateManager: GameStateManager
    ) {}

    abstract enter(): void | Promise<void>;
    abstract exit(): void;
    abstract update(deltaTime: number): void;
}

class MenuState extends GameState {
    enter(): void {
        console.log("📋 Entered Menu State");
        this.systems.uiManager.showStart();

        this.systems.inputManager.registerHandler(' ', (pressed) => {
            if (pressed) {
                this.systems.uiManager.hideStart();
                this.stateManager.setState('playing');
            }
        });
    }

    exit(): void {
        this.systems.uiManager.hideStart();
        this.systems.inputManager.unregisterHandler(' ');
    }

    update(deltaTime: number): void {}
}

class LoadingState extends GameState {
    enter(): void {
        console.log("⏳ Entered Loading State");
        // Simulate loading, then transition to countdown
        setTimeout(() => {
            this.stateManager.setState('countdown');
        }, 1000);
    }

    exit(): void {}
    update(deltaTime: number): void {}
}

class PlayingState extends GameState {
    private isResumingFromPause: boolean = false;
    private countdownState: {
        active: boolean;
        currentCount: number;
        type: 'game-start' | 'post-score' | null;
        timer: ReturnType<typeof setTimeout> | null;
        resolve: (() => void) | null;
    } = {
        active: false,
        currentCount: 3,
        type: null,
        timer: null,
        resolve: null
    };

    setResumingFromPause(resuming: boolean): void {
        this.isResumingFromPause = resuming;
    }

    async enter(): Promise<void> {
        console.log("🎮 Entered Playing State");
        // Set up physics system
        this.systems.physicsSystem.setRenderEngine(this.systems.renderEngine);
        this.systems.physicsSystem.setScoreManager(this.systems.scoreManager);
        
        if (this.isResumingFromPause) {
            console.log("🎮 Resuming from pause");
            // Check if there was a countdown in progress
            if (this.countdownState.active) {
                console.log("🎮 Resuming interrupted countdown");
                this.resumeCountdown();
                // Wait for countdown to finish before starting/resuming ball
                await new Promise<void>((resolve) => {
                    const originalResolve = this.countdownState.resolve;
                    this.countdownState.resolve = () => {
                        if (originalResolve) originalResolve();
                        resolve();
                    };
                });
                
                this.systems.physicsSystem.startBall();
            } else {
                console.log("🎮 No countdown to resume - resuming ball");
                this.systems.physicsSystem.resumeBall();
            }
        } else {
            console.log("🎮 Starting fresh game - doing countdown");
            await this.countdown('game-start');
            this.systems.physicsSystem.startBall();
        }
        
        this.setupInputHandlers();
        this.isResumingFromPause = false; // Reset flag after use
    }

    exit(): void {
        this.pauseCountdown();
        this.cleanupInputHandlers();
        this.systems.physicsSystem.stopBall();
    }

    update(deltaTime: number): void {
        this.updatePaddleMovement(deltaTime);
    }

    private countdown(): Promise<void>;
    private countdown(type: 'game-start'): Promise<void>;
    private countdown(type?: 'game-start'): Promise<void> {
        return new Promise((resolve) => {
            // If resuming an existing countdown, continue from where we left off
            const startingCount = this.countdownState.active ? this.countdownState.currentCount : 3;
            
            this.countdownState.active = true;
            this.countdownState.type = 'game-start';
            this.countdownState.currentCount = startingCount;
            this.countdownState.resolve = resolve;
            
            const isPostScore = false; // no post-score countdown now
            
            const tick = () => {
                if (!this.countdownState.active) {
                    // Countdown was paused, don't continue
                    return;
                }
                
                if (isPostScore) {
                    console.log(`⏱️ ${this.countdownState.currentCount}...`);
                    this.systems.uiManager.showCountdown(this.countdownState.currentCount);
                } else {
                    console.log(this.countdownState.currentCount);
                    this.systems.uiManager.showCountdown(this.countdownState.currentCount);
                }
                
                if (this.countdownState.currentCount <= 0) {
                    this.finishCountdown();
                } else {
                    this.countdownState.currentCount--;
                    this.countdownState.timer = setTimeout(tick, 1000);
                }
            };
            
            tick();
        });
    }

    private finishCountdown(): void {
        if (this.countdownState.timer) {
            clearTimeout(this.countdownState.timer);
        }
        
        console.log("Countdown finished!");
        
        if (this.countdownState.resolve) {
            this.countdownState.resolve();
        }
        
        this.resetCountdownState();
        this.systems.uiManager.clearCountdown();
    }

    private pauseCountdown(): void {
        if (this.countdownState.active && this.countdownState.timer) {
            clearTimeout(this.countdownState.timer);
            this.countdownState.timer = null;
            console.log(`⏸️ Countdown paused at ${this.countdownState.currentCount}`);
        }
    }

    private resumeCountdown(): void {
        if (this.countdownState.active && !this.countdownState.timer && this.countdownState.resolve) {
            // Reset countdown to 3 when resuming after pause
            this.countdownState.currentCount = 3;
            console.log(`▶️ Restarting countdown from 3`);
            const isPostScore = false;
            
            const tick = () => {
                if (!this.countdownState.active) {
                    return;
                }
                
                if (isPostScore) {
                    console.log(`⏱️ ${this.countdownState.currentCount}...`);
                    this.systems.uiManager.showCountdown(this.countdownState.currentCount);
                } else {
                    console.log(this.countdownState.currentCount);
                    this.systems.uiManager.showCountdown(this.countdownState.currentCount);
                }
                
                if (this.countdownState.currentCount <= 0) {
                    this.finishCountdown();
                } else {
                    this.countdownState.currentCount--;
                    this.countdownState.timer = setTimeout(tick, 1000);
                }
            };
            
            tick();
        }
    }

    private resetCountdownState(): void {
        this.countdownState.active = false;
        this.countdownState.currentCount = 3;
        this.countdownState.type = null;
        this.countdownState.timer = null;
        this.countdownState.resolve = null;
    }

    private setupInputHandlers(): void {
        this.systems.inputManager.registerHandler(' ', (pressed) => {
            if (pressed) {
                this.stateManager.setState('paused');
            }
        });
    }

    private updatePaddleMovement(deltaTime: number): void {
        // Left paddle movement (Up/Down arrow keys)
        let leftInput = 0;
        if (this.systems.inputManager.isKeyPressed('arrowup')) leftInput += 1;
        if (this.systems.inputManager.isKeyPressed('arrowdown')) leftInput -= 1;

        if (leftInput !== 0) {
            this.systems.physicsSystem.updatePaddlePosition('paddleLeft', leftInput, deltaTime);
        }

        // Right paddle movement (W/S keys)
        let rightInput = 0;
        if (this.systems.inputManager.isKeyPressed('w')) rightInput += 1;
        if (this.systems.inputManager.isKeyPressed('s')) rightInput -= 1;
        
        if (rightInput !== 0) {
            this.systems.physicsSystem.updatePaddlePosition('paddleRight', rightInput, deltaTime);
        }
    }

    private cleanupInputHandlers(): void {
        this.systems.inputManager.unregisterHandler(' ');
    }
}

class PausedState extends GameState {
    enter(): void {
        console.log("⏸️ Entered Paused State");
        this.systems.uiManager.showPause({
            onResume: () => {
                const playingState = this.stateManager.getState('playing') as PlayingState;
                if (playingState) playingState.setResumingFromPause(true);
                this.stateManager.setState('playing');
            },
            onRestart: () => {
                this.systems.scoreManager.reset();
                this.systems.physicsSystem.stopBall();
                this.systems.uiManager.hidePause();
                const playingState = this.stateManager.getState('playing') as PlayingState;
                if (playingState) playingState.setResumingFromPause(false);
                this.stateManager.setState('playing');
            }
        });

        this.systems.inputManager.registerHandler(' ', (pressed) => {
            if (pressed) {
                const playingState = this.stateManager.getState('playing') as PlayingState;
                if (playingState) playingState.setResumingFromPause(true);
                this.stateManager.setState('playing');
            }
        });
    }

    exit(): void {
        this.systems.uiManager.hidePause();
        this.systems.inputManager.unregisterHandler(' ');
    }

    update(deltaTime: number): void {}
}

class GameOverState extends GameState {
    enter(): void {
        console.log("🏁 Entered Game Over State");
        
        this.systems.inputManager.registerHandler('r', (pressed) => {
            if (pressed) {
                this.systems.scoreManager.reset();
                const playingState = this.stateManager.getState('playing') as PlayingState;
                if (playingState) playingState.setResumingFromPause(false);
                this.stateManager.setState('playing');
            }
        });
    }

    exit(): void {
        this.systems.inputManager.unregisterHandler('r');
    }

    update(deltaTime: number): void {}
}