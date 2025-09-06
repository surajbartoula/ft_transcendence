import * as BABYLON from "@babylonjs/core";
import { PhysicsSystem } from "./PhysicsSystem";
import { RenderEngine } from "./RenderEngine";

export class AIPlayer {
    private physicsSystem: PhysicsSystem; /** Gives access to ball position/velocity */
    private renderEngine: RenderEngine; /** Access to paddle meshes */
    private isActive: boolean = false;
    private currentInput: number = 0; /** Output can be -1 to 1 paddle movement */
    
    /** Ball tracking */
    private ballPosition: BABYLON.Vector3 = new BABYLON.Vector3(); /** Current ball position */
    private ballVelocity: BABYLON.Vector3 = new BABYLON.Vector3(); /** Current ball velocity */
    private previousBallPosition: BABYLON.Vector3 = new BABYLON.Vector3(); /** Previous frame position */
    
    /** AI state */
    private targetPaddleZ: number = 0; /** Where paddle should move to */
    private currentPaddleZ: number = 0; /** Current paddle position */
    
    /** Game boundaries and constants */
    private readonly BALL_RADIUS = 0.39; /** Ball collision radius */
    private readonly PADDLE_X_POSITION = 20.28; // Right paddle X position
    
    constructor(physicsSystem: PhysicsSystem, renderEngine: RenderEngine) {
        this.physicsSystem = physicsSystem;
        this.renderEngine = renderEngine;
    }

    initialize(): void {
        this.isActive = true;
        this.currentInput = 0;
        this.targetPaddleZ = 0;
        this.currentPaddleZ = 0;
        /** Initialize ball tracking */
        this.updateBallTracking();
        /** Get initial paddle position */
        this.updatePaddleState();
    }

    stop(): void {
        this.isActive = false;
        this.currentInput = 0;
    }

	/** Main loop to track the ball, get current position of the pedal and move the pedal to the ball */
    update(deltaTime: number): void {
        if (!this.isActive || !this.physicsSystem || !this.renderEngine) return;
        /** Get latest ball data from physics system */
        this.updateBallTracking();
        /** Get current paddle position */
        this.updatePaddleState();
        /** Calculate where paddle should go */
        this.calculateTargetPosition();
        /** Update paddle towards target immediately */
        this.updateMovement(deltaTime / 1000);
    }

    private updateBallTracking(): void {
        const ballPosition = this.physicsSystem.getBallPosition();
        const ballVelocity = this.physicsSystem.getBallVelocity();
        if (ballPosition && ballVelocity) {
            this.previousBallPosition.copyFrom(this.ballPosition);
            this.ballPosition.copyFrom(ballPosition);
            this.ballVelocity.copyFrom(ballVelocity);
        }
    }
    
    private updatePaddleState(): void {
        const rightPaddle = this.renderEngine.getMesh('paddleRight');
        if (rightPaddle) {
            this.currentPaddleZ = rightPaddle.position.z;
        }
    }
    
    private calculateTargetPosition(): void {
        if (!this.physicsSystem.isBallActive()) {
            this.targetPaddleZ = 0; /** Center position when ball is inactive */
            return;
        }
        /** Predict where ball will be when it reaches paddle */
        if (this.ballVelocity.x > 0) {
            /** Ball moving toward AI paddle - predict intersection */
            const timeToReachPaddle = (this.PADDLE_X_POSITION - this.ballPosition.x) / this.ballVelocity.x;
            if (timeToReachPaddle > 0) {
                let predictedZ = this.ballPosition.z + (this.ballVelocity.z * timeToReachPaddle);
                /** Account for wall bounces */
                const floorPlane = this.renderEngine.getMesh('floorPlane');
                if (floorPlane) {
                    floorPlane.computeWorldMatrix(true);
                    floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
                    const floorBounds = floorPlane.getBoundingInfo().boundingBox;
                    const minZ = floorBounds.minimumWorld.z + this.BALL_RADIUS;
                    const maxZ = floorBounds.maximumWorld.z - this.BALL_RADIUS;
                    /** Simple bounce calculation */
                    while (predictedZ < minZ || predictedZ > maxZ) {
                        if (predictedZ < minZ) predictedZ = minZ + (minZ - predictedZ);
                        if (predictedZ > maxZ) predictedZ = maxZ - (predictedZ - maxZ);
                    }
                }
                
                this.targetPaddleZ = this.clampToPaddleBounds(predictedZ);
            } else {
                this.targetPaddleZ = this.ballPosition.z;
            }
        } else {
            /** Ball moving away - just track current ball position */
            this.targetPaddleZ = this.ballPosition.z;
        }
    }
    
    
    private clampToPaddleBounds(z: number): number {
        /** Get paddle movement boundaries from physics system */
        const rightPaddle = this.renderEngine.getMesh('paddleRight');
        if (!rightPaddle) return z;
        
        const testPosition = new BABYLON.Vector3(this.PADDLE_X_POSITION, 1.0, z);
        const clampedPosition = this.physicsSystem.clampPaddlePosition('paddleRight', testPosition);
        return clampedPosition.z;
    }
    
    private updateMovement(_deltaTime: number): void {
        const positionError = this.targetPaddleZ - this.currentPaddleZ;
        if (Math.abs(positionError) < 0.1) {
            /** Very close to target - stop */
            this.currentInput = 0;
        } else {
            /** Move toward target */
            this.currentInput = Math.sign(positionError);
        }
        /** Clamp to ensure valid input range */
        this.currentInput = Math.max(-1, Math.min(1, this.currentInput));
    }

    getInput(): number {
        return this.currentInput;
    }
}