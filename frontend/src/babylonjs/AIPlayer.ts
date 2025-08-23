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
    private updateInterval: number = 1000; // AI makes decisions once per second
    private trackingInterval: number = 100; // AI tracks ball position more frequently  
    private lastTrackingTime: number = 0;
    private currentInput: number = 0;
    
    // AI state tracking
    private ballPosition: BABYLON.Vector3 = new BABYLON.Vector3();
    private ballVelocity: BABYLON.Vector3 = new BABYLON.Vector3();
    private paddlePosition: BABYLON.Vector3 = new BABYLON.Vector3();
    private predictedBallY: number = 0;
    private difficulty: 'easy' | 'medium' | 'hard' = 'hard';
    
    // AI behavior parameters
    private reactionTime: number = 50; // ms delay - more responsive
    private accuracy: number = 0.9; // Higher accuracy for better shot tracking
    private maxSpeed: number = 1.0; // Speed multiplier (same as human players)
    private anticipationDistance: number = 12; // Closer tracking distance
    private previousBallPosition: BABYLON.Vector3 = new BABYLON.Vector3();

    constructor(physicsSystem: PhysicsSystem, renderEngine: RenderEngine) {
        this.physicsSystem = physicsSystem;
        this.renderEngine = renderEngine;
    }

    initialize(): void {
        this.isActive = true;
        this.lastUpdateTime = Date.now();
        this.lastTrackingTime = Date.now();
        this.currentInput = 0;
        
        // Initialize ball position tracking
        this.previousBallPosition.set(0, 0, 0);
        this.ballPosition.set(0, 0, 0);
        this.ballVelocity.set(0, 0, 0);
        
        // Set AI to hard difficulty by default
        this.setDifficulty('hard');
        
        console.log("🤖 AI Player initialized with enhanced responsiveness and real physics data");
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
                this.reactionTime = 200;
                this.anticipationDistance = 10;
                break;
            case 'medium':
                this.accuracy = 0.8;
                this.reactionTime = 100;
                this.anticipationDistance = 12;
                break;
            case 'hard':
                this.accuracy = 0.95;
                this.reactionTime = 30; // Very responsive
                this.anticipationDistance = 15;
                break;
        }
        
        console.log(`🤖 AI difficulty set to: ${difficulty}`);
    }

    update(deltaTime: number): void {
        if (!this.isActive) return;

        const currentTime = Date.now();
        
        // Track ball position more frequently for better awareness
        if (currentTime - this.lastTrackingTime >= this.trackingInterval) {
            this.trackBallState();
            this.lastTrackingTime = currentTime;
            
            // Check for immediate threats that need instant response
            this.checkForImmediateThreats();
        }
        
        // Make AI decisions once per second to simulate human processing
        if (currentTime - this.lastUpdateTime >= this.updateInterval) {
            this.makeDecision();
            this.lastUpdateTime = currentTime;
        }
    }

    getInput(): number {
        return this.currentInput;
    }

    private trackBallState(): void {
        if (!this.renderEngine || !this.physicsSystem) return;

        // Continuously track ball for better awareness (every 100ms)
        const ballPosition = this.physicsSystem.getBallPosition();
        const ballVelocity = this.physicsSystem.getBallVelocity();
        const paddle = this.renderEngine.getMesh('paddleRight'); // AI controls right paddle
        
        if (ballPosition && paddle && this.physicsSystem.isBallActive()) {
            // Update current ball state
            this.ballPosition.copyFrom(ballPosition);
            this.ballVelocity.copyFrom(ballVelocity);
            this.paddlePosition.copyFrom(paddle.position);
        }
    }

    private checkForImmediateThreats(): void {
        if (!this.renderEngine || !this.physicsSystem || !this.physicsSystem.isBallActive()) return;

        const ballX = this.ballPosition.x;
        const paddleX = this.paddlePosition.x;
        const distance = paddleX - ballX;
        const ballVelX = this.ballVelocity.x;
        
        // Define immediate threat: fast ball coming directly and close
        const isImmediateThreat = ballVelX > 2 && distance < 5 && distance > 0;
        
        if (isImmediateThreat) {
            console.log(`🤖 IMMEDIATE THREAT! Fast ball incoming - emergency response!`);
            // Override normal decision making for immediate response
            this.predictBallPosition();
            this.calculateInput();
        }
    }

    private makeDecision(): void {
        if (!this.renderEngine || !this.physicsSystem) return;
        
        // Ensure we have current data
        this.trackBallState();
        
        if (this.physicsSystem.isBallActive()) {
            // Check if this is a direct threat that needs immediate response
            const ballX = this.ballPosition.x;
            const paddleX = this.paddlePosition.x;
            const distance = paddleX - ballX;
            const ballVelX = this.ballVelocity.x;
            const isDirectThreat = ballVelX > 0.5 && distance < 8;
            
            if (isDirectThreat) {
                console.log(`🤖 DIRECT THREAT detected! Ball: (${ballX.toFixed(2)}, ${this.ballPosition.z.toFixed(2)}), Vel: (${ballVelX.toFixed(2)}, ${this.ballVelocity.z.toFixed(2)}) - IMMEDIATE RESPONSE!`);
            } else {
                console.log(`🤖 AI decision - Ball: (${ballX.toFixed(2)}, ${this.ballPosition.z.toFixed(2)}), Vel: (${ballVelX.toFixed(2)}, ${this.ballVelocity.z.toFixed(2)})`);
            }
            
            // Predict and calculate new input
            this.predictBallPosition();
            this.calculateInput();
        }
    }

    // Removed calculateBallVelocity - now using real physics data

    private predictBallPosition(): void {
        const paddleX = this.paddlePosition.x;
        const ballX = this.ballPosition.x;
        const ballZ = this.ballPosition.z;
        const ballVelX = this.ballVelocity.x;
        const ballVelZ = this.ballVelocity.z;

        // Check if ball is moving towards AI paddle (right side)
        if (ballVelX > 0.5 && ballX < paddleX) {
            const timeToReach = (paddleX - ballX) / ballVelX;
            const distance = paddleX - ballX;
            
            // Special handling for direct shots (close range, little time to react)
            if (distance < 8 && timeToReach < 0.8) {
                // Direct shot - use simple linear prediction, no complex bounces
                let directPrediction = ballZ + (ballVelZ * timeToReach);
                
                // Simple clamp for direct shots
                const wallTop = 9.5;
                const wallBottom = -9.5;
                directPrediction = Math.max(wallBottom, Math.min(wallTop, directPrediction));
                
                // For direct shots, be more aggressive and accurate
                this.predictedBallY = directPrediction;
                
                console.log(`🤖 DIRECT SHOT detected! Z: ${this.predictedBallY.toFixed(2)} (dist: ${distance.toFixed(1)}, time: ${timeToReach.toFixed(2)}s)`);
                return;
            }
            
            // Normal prediction for longer shots with bounces
            let predictedZ = ballZ + (ballVelZ * timeToReach);
            
            // Handle wall bounces for longer shots
            const wallTop = 9.5;
            const wallBottom = -9.5;
            
            // Check if ball will hit walls
            if (Math.abs(ballVelZ) > 0.1) { // Only if ball has significant Z velocity
                if (predictedZ > wallTop) {
                    // Will hit top wall
                    const wallHitTime = (wallTop - ballZ) / ballVelZ;
                    const remainingTime = timeToReach - wallHitTime;
                    if (remainingTime > 0) {
                        predictedZ = wallTop - (ballVelZ * remainingTime);
                    }
                } else if (predictedZ < wallBottom) {
                    // Will hit bottom wall  
                    const wallHitTime = (wallBottom - ballZ) / ballVelZ;
                    const remainingTime = timeToReach - wallHitTime;
                    if (remainingTime > 0) {
                        predictedZ = wallBottom - (ballVelZ * remainingTime);
                    }
                }
            }
            
            // Clamp to field boundaries
            predictedZ = Math.max(wallBottom, Math.min(wallTop, predictedZ));
            
            // Add minimal error for realism
            const error = (Math.random() - 0.5) * (1 - this.accuracy) * 1.0;
            this.predictedBallY = predictedZ + error;
            
            console.log(`🤖 Long shot prediction Z: ${this.predictedBallY.toFixed(2)} (dist: ${distance.toFixed(1)}, time: ${timeToReach.toFixed(2)}s)`);
        } else if (ballVelX < -0.5) {
            // Ball moving away - return to center gradually
            this.predictedBallY = ballZ * 0.3;
        } else {
            // Ball moving slowly or sideways - track current position
            this.predictedBallY = ballZ * 0.7;
        }
    }

    // Removed complex wall bounce prediction - using simpler method now

    private calculateInput(): void {
        const paddleZ = this.paddlePosition.z;
        const targetZ = this.predictedBallY;
        const difference = targetZ - paddleZ;
        
        // Check if this is an urgent situation (direct shot)
        const ballX = this.ballPosition.x;
        const paddleX = this.paddlePosition.x;
        const distance = paddleX - ballX;
        const ballVelX = this.ballVelocity.x;
        const isDirectThreat = ballVelX > 0.5 && distance < 8;
        
        // Adjust dead zone based on urgency
        const deadZone = isDirectThreat ? 0.1 : 0.2; // Smaller dead zone for direct threats
        
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
        
        // Scale input based on urgency and distance
        const distance_abs = Math.abs(difference);
        let intensity;
        
        if (isDirectThreat) {
            // For direct threats, move at full speed immediately
            intensity = 1.0;
            console.log(`🤖 URGENT move: ${desiredInput.toFixed(2)} (diff: ${difference.toFixed(2)}) - DIRECT THREAT!`);
        } else {
            // Normal proportional movement
            intensity = Math.min(1.0, distance_abs / 3.0);
            console.log(`🤖 Normal move: ${desiredInput.toFixed(2)} (diff: ${difference.toFixed(2)})`);
        }
        
        desiredInput *= intensity;
        
        // Use different reaction times based on urgency
        const reactionTime = isDirectThreat ? 10 : this.reactionTime; // Almost instant for direct threats
        this.scheduleInput(desiredInput, reactionTime);
    }

    // Simplified strategic behavior - removed for better responsiveness

    private scheduleInput(input: number, customReactionTime?: number): void {
        // Use custom reaction time or default
        const reactionTime = customReactionTime ?? this.reactionTime;
        
        // Simulate human reaction time
        setTimeout(() => {
            this.currentInput = input * this.maxSpeed;
        }, reactionTime);
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