import * as BABYLON from "@babylonjs/core";
import { PhysicsSystem } from "./PhysicsSystem";
import { RenderEngine } from "./RenderEngine";

// =====================================
// AI PLAYER SYSTEM
// =====================================
export class AIPlayer {
    private physicsSystem: PhysicsSystem;
    private renderEngine: RenderEngine;
    private isActive: boolean = false;
    private lastUpdateTime: number = 0;
    private updateInterval: number = 1000; // AI updates once per second
    private currentInput: number = 0;
    
    // AI state tracking
    private ballPosition: BABYLON.Vector3 = new BABYLON.Vector3();
    private ballVelocity: BABYLON.Vector3 = new BABYLON.Vector3();
    private paddlePosition: BABYLON.Vector3 = new BABYLON.Vector3();
    private predictedBallY: number = 0;
    private difficulty: 'easy' | 'medium' | 'hard' = 'medium';
    
    // AI behavior parameters
    private reactionTime: number = 100; // ms delay to simulate human reaction
    private accuracy: number = 0.8; // How accurate the AI predictions are
    private maxSpeed: number = 1.0; // Speed multiplier (same as human players)
    private anticipationDistance: number = 15; // How far ahead the AI looks

    constructor(physicsSystem: PhysicsSystem, renderEngine: RenderEngine) {
        this.physicsSystem = physicsSystem;
        this.renderEngine = renderEngine;
    }

    initialize(): void {
        this.isActive = true;
        this.lastUpdateTime = Date.now();
        this.currentInput = 0;
        console.log("🤖 AI Player initialized");
    }

    stop(): void {
        this.isActive = false;
        this.currentInput = 0;
        console.log("🤖 AI Player stopped");
    }

    setDifficulty(difficulty: 'easy' | 'medium' | 'hard'): void {
        this.difficulty = difficulty;
        
        switch (difficulty) {
            case 'easy':
                this.accuracy = 0.6;
                this.reactionTime = 300;
                this.anticipationDistance = 10;
                break;
            case 'medium':
                this.accuracy = 0.8;
                this.reactionTime = 200;
                this.anticipationDistance = 15;
                break;
            case 'hard':
                this.accuracy = 0.95;
                this.reactionTime = 100;
                this.anticipationDistance = 20;
                break;
        }
        
        console.log(`🤖 AI difficulty set to: ${difficulty}`);
    }

    update(deltaTime: number): void {
        if (!this.isActive) return;

        const currentTime = Date.now();
        
        // AI only updates its "view" once per second to simulate human limitation
        if (currentTime - this.lastUpdateTime >= this.updateInterval) {
            this.updateAIState();
            this.calculateInput();
            this.lastUpdateTime = currentTime;
        }
    }

    getInput(): number {
        return this.currentInput;
    }

    private updateAIState(): void {
        if (!this.renderEngine) return;

        // Get current ball state
        const ball = this.renderEngine.getMesh('pongBall');
        const paddle = this.renderEngine.getMesh('paddleRight'); // AI controls right paddle
        
        if (ball && paddle) {
            this.ballPosition.copyFrom(ball.position);
            this.paddlePosition.copyFrom(paddle.position);
            
            // Estimate ball velocity by tracking position changes
            // In a real implementation, you'd get this from the physics system
            this.estimateBallVelocity();
            
            // Predict where the ball will be when it reaches the paddle
            this.predictBallTrajectory();
        }
    }

    private estimateBallVelocity(): void {
        // Simple velocity estimation - in practice, you'd get this from physics system
        // For now, we'll use a simplified approach
        if (this.ballPosition.x > 0) { // Ball moving towards AI
            this.ballVelocity.x = -Math.abs(this.ballVelocity.x || -5);
        } else {
            this.ballVelocity.x = Math.abs(this.ballVelocity.x || 5);
        }
    }

    private predictBallTrajectory(): void {
        const paddleX = this.paddlePosition.x;
        const ballX = this.ballPosition.x;
        const ballZ = this.ballPosition.z;
        const ballVelX = this.ballVelocity.x;
        const ballVelZ = this.ballVelocity.z || 0;

        // Only predict if ball is moving towards AI paddle
        if (ballVelX > 0 && ballX < paddleX) {
            // Calculate time for ball to reach paddle X position
            const timeToReach = (paddleX - ballX) / Math.abs(ballVelX);
            
            // Predict ball Z position at that time
            let predictedZ = ballZ + (ballVelZ * timeToReach);
            
            // Account for wall bounces in prediction
            predictedZ = this.accountForWallBounces(predictedZ, timeToReach);
            
            // Add some inaccuracy based on difficulty
            const error = (Math.random() - 0.5) * 2 * (1 - this.accuracy) * 5;
            this.predictedBallY = predictedZ + error;
            
            console.log(`🤖 AI predicts ball at Z: ${this.predictedBallY.toFixed(2)}`);
        } else {
            // Ball moving away or parallel - maintain center position
            this.predictedBallY = 0;
        }
    }

    private accountForWallBounces(predictedZ: number, timeToReach: number): number {
        // Simple wall bounce prediction
        const wallTop = 10; // Approximate wall boundaries
        const wallBottom = -10;
        
        let currentZ = predictedZ;
        let currentVelZ = this.ballVelocity.z || 0;
        let remainingTime = timeToReach;
        
        // Simulate bounces for a few iterations
        for (let i = 0; i < 5 && remainingTime > 0; i++) {
            if (currentZ > wallTop) {
                const bounceTime = (currentZ - wallTop) / Math.abs(currentVelZ);
                currentZ = wallTop - ((bounceTime - Math.floor(bounceTime)) * Math.abs(currentVelZ));
                currentVelZ = -Math.abs(currentVelZ);
                remainingTime -= bounceTime;
            } else if (currentZ < wallBottom) {
                const bounceTime = (wallBottom - currentZ) / Math.abs(currentVelZ);
                currentZ = wallBottom + ((bounceTime - Math.floor(bounceTime)) * Math.abs(currentVelZ));
                currentVelZ = Math.abs(currentVelZ);
                remainingTime -= bounceTime;
            } else {
                break;
            }
        }
        
        return currentZ;
    }

    private calculateInput(): void {
        const paddleZ = this.paddlePosition.z;
        const targetZ = this.predictedBallY;
        const difference = targetZ - paddleZ;
        
        // Dead zone to prevent jittery movement
        const deadZone = 0.5;
        
        if (Math.abs(difference) < deadZone) {
            this.scheduleInput(0);
            return;
        }
        
        // Determine movement direction
        let desiredInput = 0;
        if (difference > 0) {
            desiredInput = 1; // Move up/forward
        } else if (difference < 0) {
            desiredInput = -1; // Move down/backward
        }
        
        // Add some strategic behavior
        desiredInput = this.addStrategicBehavior(desiredInput);
        
        // Schedule input with reaction time delay
        this.scheduleInput(desiredInput);
    }

    private addStrategicBehavior(baseInput: number): number {
        // Add some basic strategic elements
        
        // 1. Defensive positioning when ball is far away
        if (Math.abs(this.ballPosition.x) > this.anticipationDistance) {
            const centerBias = -this.paddlePosition.z * 0.1;
            if (Math.abs(centerBias) > Math.abs(baseInput)) {
                return centerBias > 0 ? 1 : -1;
            }
        }
        
        // 2. Aggressive positioning to return ball at angles
        if (this.ballVelocity.x > 0 && this.ballPosition.x > 15) {
            // Ball approaching fast - try to hit at an angle
            const angleBias = Math.sin(Date.now() * 0.001) * 0.3;
            if (Math.random() < 0.3) { // 30% chance for strategic positioning
                return angleBias > 0 ? 1 : -1;
            }
        }
        
        return baseInput;
    }

    private scheduleInput(input: number): void {
        // Simulate human reaction time
        setTimeout(() => {
            this.currentInput = input * this.maxSpeed;
        }, this.reactionTime);
    }

    // Public method to get AI stats for UI display
    getAIStats(): { difficulty: string, accuracy: number, reactionTime: number } {
        return {
            difficulty: this.difficulty,
            accuracy: this.accuracy,
            reactionTime: this.reactionTime
        };
    }

    // Method to make AI miss occasionally (for realism)
    private shouldMiss(): boolean {
        const missChance = this.difficulty === 'easy' ? 0.15 : 
                          this.difficulty === 'medium' ? 0.08 : 0.03;
        return Math.random() < missChance;
    }

    // Alternative AI algorithms for different strategies
    private useDefensiveStrategy(): void {
        // Focus on returning ball to center
        this.accuracy = Math.min(this.accuracy, 0.9);
        this.anticipationDistance = Math.max(this.anticipationDistance, 18);
    }

    private useAggressiveStrategy(): void {
        // Try to win points with angled shots
        this.accuracy = Math.max(this.accuracy, 0.7);
        this.reactionTime = Math.max(this.reactionTime, 150);
    }

    private useAdaptiveStrategy(): void {
        // Adapt based on game state
        const currentScore = { left: 0, right: 0 }; // Get from score manager
        
        if (currentScore.right < currentScore.left) {
            this.useAggressiveStrategy();
        } else {
            this.useDefensiveStrategy();
        }
    }
}