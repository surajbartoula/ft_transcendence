import * as BABYLON from "@babylonjs/core";
import { RenderEngine } from "./RenderEngine";
import { ScoreManager } from "./ScoreManager";

// =====================================
// PHYSICS SYSTEM
// =====================================
 export class PhysicsSystem {
	private ballVelocity: BABYLON.Vector3 = new BABYLON.Vector3(0.3, 0, 0.2);
	private ballSpeed: number = 18; // units per second
	private ballActive: boolean = false;
	private renderEngine: RenderEngine | null = null;
	private scoreManager: ScoreManager | null = null;
	private hasScored: boolean = false;

	initialize(): void {
		console.log("⚡ Physics system initialized");
	}

	setScoreManager(scoreManager: ScoreManager): void {
		this.scoreManager = scoreManager;
	}

	checkHasScored(): boolean {
		return this.hasScored;
	}

	resetScoredFlag(): void {
		this.hasScored = false;
	}

	resetPaddlePositions(): void {
		if (!this.renderEngine) return;
		
		const leftPaddle = this.renderEngine.getMesh('paddleLeft');
		const rightPaddle = this.renderEngine.getMesh('paddleRight');
		
		if (leftPaddle) {
			leftPaddle.position = new BABYLON.Vector3(-20.28, 1.00, 0.00);
			console.log("🏓 Left paddle reset to starting position");
		}
		
		if (rightPaddle) {
			rightPaddle.position = new BABYLON.Vector3(20.28, 1.00, 0.00);
			console.log("🏓 Right paddle reset to starting position");
		}
	}

	setRenderEngine(renderEngine: RenderEngine): void {
		this.renderEngine = renderEngine;
	}

	startBall(): void {
		if (!this.renderEngine) return;
		
		this.resetBallPosition();
		this.startBallMovement();
		this.ballActive = true;
		console.log("🏐 Ball movement started");
	}

	resumeBall(): void {
		if (!this.renderEngine) return;
		
		// Resume ball without resetting position
		this.ballActive = true;
		console.log("🏐 Ball movement resumed");
	}

	stopBall(): void {
		this.ballActive = false;
		console.log("🏐 Ball movement stopped");
	}

	private resetBallPosition(): void {
		if (!this.renderEngine) return;
		
		const ball = this.renderEngine.getMesh('pongBall');
		if (ball) {
			ball.position = new BABYLON.Vector3(0.00, 0.78, 0.00);
		}
	}

	private startBallMovement(): void {
		// Random initial direction, normalized and scaled to speed (units/sec)
		const randomZ = (Math.random() - 0.5) * 0.8;
		const randomX = Math.random() > 0.5 ? 1 : -1;
		const dir = new BABYLON.Vector3(randomX, 0, randomZ).normalize();
		this.ballSpeed = 18;
		this.ballVelocity = dir.scale(this.ballSpeed);
		console.log(`🏐 Ball velocity set to: (${this.ballVelocity.x.toFixed(2)}, ${this.ballVelocity.y.toFixed(2)}, ${this.ballVelocity.z.toFixed(2)}) (u/s)`);
	}

	updatePaddlePosition(paddleName: string, inputDirection: number, deltaTime: number): void {
		if (!this.renderEngine || inputDirection === 0) return;
		
		const paddle = this.renderEngine.getMesh(paddleName);
		if (!paddle) return;
		
		const moveSpeedPerSec = 12; // units/sec
		const dz = inputDirection * moveSpeedPerSec * (Math.max(0, deltaTime) / 1000);
		const intendedNewPosition = paddle.position.add(new BABYLON.Vector3(0, 0, dz));
		
		// Collision detection logic (simplified from your original)
		if (this.canPaddleMoveTo(paddle, intendedNewPosition)) {
			paddle.position.z = intendedNewPosition.z;
		}
	}

	private canPaddleMoveTo(paddle: BABYLON.AbstractMesh, newPosition: BABYLON.Vector3): boolean {
		if (!this.renderEngine) return false;
		
		const floorPlane = this.renderEngine.getMesh('floorPlane');
		if (!floorPlane) return true;
		
		floorPlane.computeWorldMatrix(true);
		floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
		const floorBounds = floorPlane.getBoundingInfo().boundingBox;
		
		paddle.computeWorldMatrix(true);
		paddle.getBoundingInfo().update(paddle.getWorldMatrix());
		const paddleBounds = paddle.getBoundingInfo().boundingBox;
		const paddleDepth = Math.abs(paddleBounds.maximumWorld.z - paddleBounds.minimumWorld.z);
		
		const frontEdge = newPosition.z + (paddleDepth / 2);
		const backEdge = newPosition.z - (paddleDepth / 2);
		
		return frontEdge <= floorBounds.maximumWorld.z && 
			   backEdge >= floorBounds.minimumWorld.z;
	}

	update(deltaTime: number): void {
		if (!this.ballActive || !this.renderEngine) return;
		
		this.updateBallPosition(deltaTime);
	}

	private updateBallPosition(deltaTime: number): void {
		if (!this.renderEngine) return;
		
		const ball = this.renderEngine.getMesh('pongBall');
		if (!ball) return;
		
		// Move ball using frame-rate independent integration
		const dt = Math.max(0, deltaTime) / 1000; // seconds
		if (dt > 0) {
			const displacement = this.ballVelocity.scale(dt);
			ball.position.addInPlace(displacement);
		}
		
		// Check collisions
		this.checkBallCollisions(ball);
	}

	private checkBallCollisions(ball: BABYLON.AbstractMesh): void {
		this.checkWallCollisions(ball);
		this.checkPaddleCollisions(ball);
	}

	private checkWallCollisions(ball: BABYLON.AbstractMesh): void {
		if (!this.renderEngine ) return;
		
		const floorPlane = this.renderEngine.getMesh('floorPlane');
		if (!floorPlane) return;
		
		floorPlane.computeWorldMatrix(true);
		floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
		const floorBounds = floorPlane.getBoundingInfo().boundingBox;
		
		const ballRadius = 0.39;
		
		if (ball.position.z + ballRadius >= floorBounds.maximumWorld.z) {
			this.ballVelocity.z = -Math.abs(this.ballVelocity.z);
			ball.position.z = floorBounds.maximumWorld.z - ballRadius;
			if (this.renderEngine && (this.renderEngine as any).playBallWallBounceSound) {
				(this.renderEngine as any).playBallWallBounceSound();
			}
		}
		
		if (ball.position.z - ballRadius <= floorBounds.minimumWorld.z) {
			this.ballVelocity.z = Math.abs(this.ballVelocity.z);
			ball.position.z = floorBounds.minimumWorld.z + ballRadius;
			if (this.renderEngine && (this.renderEngine as any).playBallWallBounceSound) {
				(this.renderEngine as any).playBallWallBounceSound();
			}
		}
	}

	private checkPaddleCollisions(ball: BABYLON.AbstractMesh): void {
		if (!this.renderEngine) return;
		
		const leftPaddle = this.renderEngine.getMesh('paddleLeft');
		const rightPaddle = this.renderEngine.getMesh('paddleRight');
		const ballRadius = 0.39;

		// Check collision with left paddle
		if (leftPaddle && this.ballCollidesWithPaddle(ball, leftPaddle, ballRadius)) {
			this.ballVelocity.x = Math.abs(this.ballVelocity.x); // Ensure ball moves right
			this.addPaddleInfluence(ball, leftPaddle);
			if (this.renderEngine && (this.renderEngine as any).playBallHitSound) {
				(this.renderEngine as any).playBallHitSound();
			}
			console.log("🏐 Ball hit left paddle");
		}

		// Check collision with right paddle  
		if (rightPaddle && this.ballCollidesWithPaddle(ball, rightPaddle, ballRadius)) {
			this.ballVelocity.x = -Math.abs(this.ballVelocity.x); // Ensure ball moves left
			this.addPaddleInfluence(ball, rightPaddle);
			if (this.renderEngine && (this.renderEngine as any).playBallHitSound) {
				(this.renderEngine as any).playBallHitSound();
			}
			console.log("🏐 Ball hit right paddle");
		}

		// Check if ball went past paddles (scoring)
		if (ball.position.x < -25) {
			if (this.scoreManager) {
				this.scoreManager.scorePoint('left');
			}
			if (this.renderEngine && (this.renderEngine as any).playScoreSound) {
				(this.renderEngine as any).playScoreSound();
			}
			this.hasScored = true;
			this.resetBall();
		} else if (ball.position.x > 25) {
			if (this.scoreManager) {
				this.scoreManager.scorePoint('right');
			}
			if (this.renderEngine && (this.renderEngine as any).playScoreSound) {
				(this.renderEngine as any).playScoreSound();
			}
			this.hasScored = true;
			this.resetBall();
		}
	}

	private ballCollidesWithPaddle(ball: BABYLON.AbstractMesh, paddle: BABYLON.AbstractMesh, ballRadius: number): boolean {
		// Simple collision detection between ball and paddle
		const ballPos = ball.position;
		const paddlePos = paddle.position;

		// Get paddle dimensions
		paddle.computeWorldMatrix(true);
		paddle.getBoundingInfo().update(paddle.getWorldMatrix());
		const paddleBounds = paddle.getBoundingInfo().boundingBox;
		
		const paddleWidth = Math.abs(paddleBounds.maximumWorld.x - paddleBounds.minimumWorld.x);
		const paddleHeight = Math.abs(paddleBounds.maximumWorld.y - paddleBounds.minimumWorld.y);
		const paddleDepth = Math.abs(paddleBounds.maximumWorld.z - paddleBounds.minimumWorld.z);

		// Check if ball is within paddle bounds
		const withinX = Math.abs(ballPos.x - paddlePos.x) < (paddleWidth / 2 + ballRadius);
		const withinY = Math.abs(ballPos.y - paddlePos.y) < (paddleHeight / 2 + ballRadius);
		const withinZ = Math.abs(ballPos.z - paddlePos.z) < (paddleDepth / 2 + ballRadius);

		return withinX && withinY && withinZ;
	}

	private addPaddleInfluence(ball: BABYLON.AbstractMesh, paddle: BABYLON.AbstractMesh): void {
		// Add some randomness and paddle position influence to ball direction
		const relativeHitPosition = (ball.position.z - paddle.position.z) / 2; // Normalize hit position
		this.ballVelocity.z += relativeHitPosition * this.ballSpeed * 0.2; // Add influence to Z direction
		
		// Slightly increase speed after each paddle hit (cap to a reasonable max)
		this.ballSpeed = Math.min(this.ballSpeed * 1.05, 36.0);
		
		// Normalize and rescale to maintain proper speed
		this.ballVelocity.normalize();
		this.ballVelocity.scaleInPlace(this.ballSpeed);
		
		console.log(`🏐 Ball speed increased to: ${this.ballSpeed.toFixed(2)}`);
	}

	private resetBall(): void {
		if (!this.renderEngine) return;
		
		const ball = this.renderEngine.getMesh('pongBall');
		if (!ball) return;

		// Reset ball to center
		ball.position = new BABYLON.Vector3(0.00, 0.78, 0.00);
		
		// Stop the ball movement temporarily
		this.ballActive = false;
		this.ballVelocity = new BABYLON.Vector3(0, 0, 0);
		
		// If someone scored, reset paddles and immediately restart ball (no UI countdown between rounds)
		if (this.hasScored) {
			this.resetPaddlePositions();
			this.resetScoredFlag();
			this.resetBallMovement();
		} else {
			this.resetBallMovement();
		}
	}

	private resetBallMovement(): void {
		// Reset with random direction and base speed (units/sec)
		const randomZ = (Math.random() - 0.5) * 0.8;
		const randomX = Math.random() > 0.5 ? 1 : -1;
		const dir = new BABYLON.Vector3(randomX, 0, randomZ).normalize();
		this.ballSpeed = 18;
		this.ballVelocity = dir.scale(this.ballSpeed);
		this.ballActive = true;
		console.log("🏐 Ball reset to center with velocity:", this.ballVelocity);
	}

	// Getter methods for AI to access ball data
	getBallVelocity(): BABYLON.Vector3 {
		return this.ballVelocity.clone();
	}

	getBallPosition(): BABYLON.Vector3 | null {
		if (!this.renderEngine) return null;
		const ball = this.renderEngine.getMesh('pongBall');
		return ball ? ball.position.clone() : null;
	}

	getBallSpeed(): number {
		return this.ballSpeed;
	}

	isBallActive(): boolean {
		return this.ballActive;
	}

	dispose(): void {
		this.ballActive = false;
	}
}