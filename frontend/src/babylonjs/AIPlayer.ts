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
    private updateInterval: number = 1000; // AI makes decisions more frequently (3x per second)
    private trackingInterval: number = 50; // AI tracks ball position very frequently  
    private lastTrackingTime: number = 0;
    private currentInput: number = 0;
    
    // AI state tracking
    private ballPosition: BABYLON.Vector3 = new BABYLON.Vector3();
    private ballVelocity: BABYLON.Vector3 = new BABYLON.Vector3();
    private paddlePosition: BABYLON.Vector3 = new BABYLON.Vector3();
    private predictedBallY: number = 0;
    // AI behavior parameters - fixed for consistent gameplay
    private reactionTime: number = 50; // ms delay - responsive
    private accuracy: number = 0.95; // High accuracy for challenging gameplay
    private maxSpeed: number = 1.0; // Speed multiplier (same as human players)
    private anticipationDistance: number = 15; // Optimal tracking distance
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
        
        // AI parameters are now fixed - no difficulty setting needed
    }

    stop(): void {
        this.isActive = false;
        this.currentInput = 0;
        // AI Player stopped
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
            // Immediate threat detected
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
                // Direct threat detected
            } else {
                // AI decision made
            }
            
            // Predict and calculate new input
            this.predictBallPosition();
            this.calculateInput();
        }
    }

    private predictBallPosition(): void {
        const paddleX = this.paddlePosition.x;
        const ballX = this.ballPosition.x;
        const ballZ = this.ballPosition.z;
        const ballVelX = this.ballVelocity.x;
        const ballVelZ = this.ballVelocity.z;

        // Always predict if ball is moving towards AI paddle (right side)
        if (ballVelX > 0.1 && ballX < paddleX) {
            const timeToReach = (paddleX - ballX) / ballVelX;
            let predictedZ = ballZ + (ballVelZ * timeToReach);
            
            // Improved wall bounce handling
            const wallTop = 9.5;
            const wallBottom = -9.5;
            
            // Handle multiple bounces more accurately
            if (Math.abs(ballVelZ) > 0.01) {
                let remainingTime = timeToReach;
                let currentZ = ballZ;
                let currentVelZ = ballVelZ;
                
                // Simulate up to 3 bounces
                for (let i = 0; i < 3 && remainingTime > 0; i++) {
                    if (currentVelZ > 0) {
                        // Moving toward top wall
                        const timeToWall = (wallTop - currentZ) / currentVelZ;
                        if (timeToWall < remainingTime && timeToWall > 0) {
                            currentZ = wallTop;
                            currentVelZ = -Math.abs(currentVelZ); // Bounce
                            remainingTime -= timeToWall;
                            continue;
                        }
                    } else if (currentVelZ < 0) {
                        // Moving toward bottom wall
                        const timeToWall = (wallBottom - currentZ) / currentVelZ;
                        if (timeToWall < remainingTime && timeToWall > 0) {
                            currentZ = wallBottom;
                            currentVelZ = Math.abs(currentVelZ); // Bounce
                            remainingTime -= timeToWall;
                            continue;
                        }
                    }
                    
                    // No more bounces, calculate final position
                    predictedZ = currentZ + (currentVelZ * remainingTime);
                    break;
                }
            }
            
            // Clamp to field boundaries
            predictedZ = Math.max(wallBottom, Math.min(wallTop, predictedZ));
            
            // Reduce error significantly for better accuracy
            const error = (Math.random() - 0.5) * (1 - this.accuracy) * 0.3;
            this.predictedBallY = predictedZ + error;
            
        } else if (ballVelX < -0.1) {
            // Ball moving away - smart positioning
            this.predictedBallY = ballZ * 0.5; // Less aggressive centering
        } else {
            // Ball moving slowly - track more aggressively
            this.predictedBallY = ballZ;
        }
    }

    private calculateInput(): void {
        const paddleZ = this.paddlePosition.z;
        const targetZ = this.predictedBallY;
        const difference = targetZ - paddleZ;
        
        // Check if this is an urgent situation (ball approaching)
        const ballX = this.ballPosition.x;
        const paddleX = this.paddlePosition.x;
        const distance = paddleX - ballX;
        const ballVelX = this.ballVelocity.x;
        const isDirectThreat = ballVelX > 0.2 && distance < 12; // More sensitive detection
        
        // Much smaller dead zone for better accuracy
        const deadZone = isDirectThreat ? 0.05 : 0.1; // Smaller dead zones
        
        if (Math.abs(difference) < deadZone) {
            this.scheduleInput(0);
            return;
        }
        
        // Determine movement direction and intensity
        let desiredInput = 0;
        const distance_abs = Math.abs(difference);
        
        if (difference > 0) {
            desiredInput = 1; // Move up/forward
        } else if (difference < 0) {
            desiredInput = -1; // Move down/backward
        }
        
        // Improved intensity calculation
        let intensity;
        
        if (isDirectThreat) {
            // For threats, use proportional speed but ensure minimum intensity
            intensity = Math.max(0.6, Math.min(1.0, distance_abs / 2.0));
        } else {
            // For normal situations, use more responsive movement
            intensity = Math.max(0.3, Math.min(1.0, distance_abs / 2.5));
        }
        
        desiredInput *= intensity;
        
        // Use different reaction times based on urgency
        const reactionTime = isDirectThreat ? 10 : this.reactionTime; // Almost instant for direct threats
        this.scheduleInput(desiredInput, reactionTime);
    }

    private scheduleInput(input: number, customReactionTime?: number): void {
        // Use custom reaction time or default
        const reactionTime = customReactionTime ?? this.reactionTime;
        
        // Simulate human reaction time
        setTimeout(() => {
            this.currentInput = input * this.maxSpeed;
        }, reactionTime);
    }

    // Public method to get AI stats for UI display
    getAIStats(): { accuracy: number, reactionTime: number } {
        return {
            accuracy: this.accuracy,
            reactionTime: this.reactionTime
        };
    }

}