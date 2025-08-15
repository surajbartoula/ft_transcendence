import { GameStateManager } from "./GameStateManager";
import { RenderEngine } from "./RenderEngine";
import { InputManager } from "./InputManager";
import { PhysicsSystem } from "./PhysicsSystem";
import { ScoreManager } from "./ScoreManager";
import { UIManager } from "./UIManager";
import { AudioManager } from "./AudioManager";

// =====================================
// MAIN GAME MANAGER - Orchestrator
// =====================================
export class PongGameManager {
    private gameState: GameStateManager;
    private renderEngine: RenderEngine;
    private inputManager: InputManager;
    private physicsSystem: PhysicsSystem;
    private audioManager: AudioManager;
    private uiManager: UIManager;
    private scoreManager: ScoreManager;

    private isRunning: boolean = false;
    private lastTime: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        // Initialize all systems
        this.renderEngine = new RenderEngine(canvas); // 🎨 The "visual display" chef
        this.inputManager = new InputManager();       // 🎮 The "order taker" (keyboard/mouse)
        this.physicsSystem = new PhysicsSystem();    // ⚡ The "movement & collision" chef
        this.audioManager = new AudioManager();      // 🔊 The "sound effects" DJ
        this.uiManager = new UIManager();           // 🖥️ The "menu display" manager
        this.scoreManager = new ScoreManager();     // 🥅 The "score keeper" manager

        // Initialize game state manager with references to all systems
        this.gameState = new GameStateManager({
            renderEngine: this.renderEngine,
            inputManager: this.inputManager,
            physicsSystem: this.physicsSystem,
            audioManager: this.audioManager,
            uiManager: this.uiManager,
            scoreManager: this.scoreManager
        });
        this.initialize();
    }

    private async initialize(): Promise<void> {
        console.log("🎮 Initializing Pong Game Manager...");
        
        // Initialize all systems in order
        await this.renderEngine.initialize();
        this.inputManager.initialize();
        this.physicsSystem.initialize();
        this.audioManager.initialize();
        this.uiManager.initialize();
        this.scoreManager.initialize();

        // Hook score change to UI flash
        this.scoreManager.setScoreChangeCallback(({ leftScore, rightScore, scorer }) => {
            this.uiManager.showScoreFlash({ scorer, leftScore, rightScore });
        });

        // Start with menu state
        this.gameState.setState('menu');
        this.startGameLoop();
        
        console.log("✅ Game Manager initialized successfully!");
    }

    private startGameLoop(): void {
        this.isRunning = true;
        
        const gameLoop = (timestamp: number) => {
            if (!this.isRunning) return;
            
            const deltaTime = timestamp - this.lastTime;
            this.lastTime = timestamp;

            // Update all systems
            this.gameState.update(deltaTime);
            this.physicsSystem.update(deltaTime);
            this.renderEngine.update(deltaTime);
            this.uiManager.update(deltaTime);

            // Render
            this.renderEngine.render();
            this.uiManager.render();

            requestAnimationFrame(gameLoop);
        };

        requestAnimationFrame(gameLoop);
    }

    public dispose(): void {
        this.isRunning = false;
        this.renderEngine.dispose();
        this.inputManager.dispose();
        this.physicsSystem.dispose();
        this.audioManager.dispose();
        this.uiManager.dispose();
    }
}
