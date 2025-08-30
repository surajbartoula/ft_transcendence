import * as BABYLON from "@babylonjs/core";
import { GLTFFileLoader } from "@babylonjs/loaders/glTF";
import { GUIManager } from "./GuiManager";
import { GameObject3D } from "./GameObject3d";

// =====================================
// RENDER ENGINE - 3D Babylon.js Layer
// =====================================
export class RenderEngine {
	private engine: BABYLON.Engine;
	private scene: BABYLON.Scene;
	private camera!: BABYLON.ArcRotateCamera;
	private gameObjects: Map<string, GameObject3D> = new Map();
	private cameraLocked: boolean = false;
	private ballVelocity: BABYLON.Vector3 = new BABYLON.Vector3(0.3, 0, 0.2); // Ball velocity in X and Z directions
	private ballSpeed: number = 0.4; // Base ball speed
	private isPaused: boolean = false; // Game pause state
	private guiManager: GUIManager; // GUI manager instance
	
	// Audio System Properties
	private audioContext: AudioContext | null = null;
	private boundaryHitSound: BABYLON.Sound | null = null;
	private ballPaddleHitSound: BABYLON.Sound | null = null;
	private ballWallBounceSound: BABYLON.Sound | null = null;
	private scoreSound: BABYLON.Sound | null = null;
	private pauseSound: BABYLON.Sound | null = null;
	private lastBoundaryHitTime: number = 0;
	private lastBallHitTime: number = 0;
	private boundaryHitCooldown: number = 200; // ms between sounds
	private ballHitCooldown: number = 100; // ms between ball hit sounds

	constructor(private canvas: HTMLCanvasElement) {
		this.engine = new BABYLON.Engine(this.canvas, true, {
			adaptToDeviceRatio: true,
			antialias: true,
			preserveDrawingBuffer: true,
			stencil: true
		});
		this.scene = new BABYLON.Scene(this.engine);
		this.guiManager = new GUIManager();

		console.log("🔧 Registering GLB loader...");
		if (!BABYLON.SceneLoader.IsPluginForExtensionAvailable(".glb")) {
			BABYLON.SceneLoader.RegisterPlugin(new GLTFFileLoader());
			console.log("✅ GLB loader registered successfully");
		} else {
			console.log("✅ GLB loader already available");
		}
		
		// Verify loader is now available
		console.log("🔍 GLB loader check:", BABYLON.SceneLoader.IsPluginForExtensionAvailable(".glb"));
	}

	async initialize(): Promise<void> {
		console.log("🎨 Initializing Render Engine...");
		
		this.setupCamera();
		this.setupLighting();
		this.setupCustomMaterials();
		this.setupResizeListener();
		this.setupAudio();
		await this.loadAssets();

		this.engine.resize();
		
		// Start render loop
		this.engine.runRenderLoop(() => {
			this.scene.render();
		});
		
		console.log("✅ Render Engine initialized!");
		console.log(`📱 Device pixel ratio: ${window.devicePixelRatio}`);
		console.log(`📐 Canvas size: ${this.canvas.width}x${this.canvas.height}`);
		console.log(`📐 Canvas display size: ${this.canvas.clientWidth}x${this.canvas.clientHeight}`);
	}

	private setupCamera(): void {
		// Create ArcRotateCamera with desired position
		this.camera = new BABYLON.ArcRotateCamera("camera", -1.569, 0.593, 43.461, BABYLON.Vector3.Zero(), this.scene);
		
		// Lock the camera - disable all controls
		this.camera.attachControl(this.canvas, false);
		this.camera.inputs.clear();
		
		this.scene.activeCamera = this.camera;
		console.log("📷 Camera locked at desired position");
	}
	
	/**
	 * Set camera perspective for multiplayer - Player 1 sees from left side, Player 2 from right side
	 */
	public setCameraForPlayer(isPlayer1: boolean): void {
		if (!this.camera) return;
		
		// Keep the same camera position for all players to maintain game layout
		// The difference should be in the UI/HUD, not camera position
		this.camera.alpha = -1.569; // Original position
		this.camera.beta = 0.593;
		this.camera.radius = 43.461;
		this.camera.setTarget(BABYLON.Vector3.Zero());
		
		if (isPlayer1) {
			console.log("📷 Camera maintained at original position - You are Player 1 (GREEN paddle on LEFT)");
		} else {
			console.log("📷 Camera maintained at original position - You are Player 2 (RED paddle on RIGHT)");
		}
	}

	private setupLighting(): void {
		this.setupStrongLightSystem();
	}

	private setupCustomMaterials(): void {
		this.createBackgroundLayers();
	}

	private setupAudio(): void {
		try {
			// Initialize Web Audio Context
			this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			console.log("🔊 Audio context initialized");

			// Handle browser autoplay policies - audio context may start suspended
			if (this.audioContext.state === 'suspended') {
				console.log("🔊 Audio context is suspended, will resume on first user interaction");
				
				// Set up one-time user interaction listener to unlock audio
				const unlockAudio = () => {
					if (this.audioContext && this.audioContext.state === 'suspended') {
						this.audioContext.resume().then(() => {
							console.log("🔊 Audio context resumed successfully");
						});
					}
					// Remove the listener after first use
					document.removeEventListener('click', unlockAudio);
					document.removeEventListener('keydown', unlockAudio);
				};
				
				document.addEventListener('click', unlockAudio);
				document.addEventListener('keydown', unlockAudio);
			}

			// Generate and create sound effects
			this.createSoundEffects();
			

		} catch (error) {
			console.warn("⚠️ Audio initialization failed:", error);
			console.warn("⚠️ Audio features will be disabled");
		}
	}

	private createSoundEffects(): void {
		if (!this.audioContext) return;

		// Instead of complex Babylon.js Sound objects, we'll use direct Web Audio API
		// This eliminates the blob conversion issues
		console.log("🔊 Setting up direct Web Audio API sound system");
		console.log("🔊 All sound effects ready (using direct Web Audio API)");
	}

	private createBeepSound(frequency: number, duration: number, volume: number): BABYLON.Sound {
		// Create a simple beep using Web Audio API and convert to Babylon.js Sound
		const sampleRate = 44100;
		const numSamples = sampleRate * duration;
		const audioBuffer = this.audioContext!.createBuffer(1, numSamples, sampleRate);
		const channelData = audioBuffer.getChannelData(0);

		// Generate sine wave with envelope
		for (let i = 0; i < numSamples; i++) {
			const t = i / sampleRate;
			const envelope = Math.sin(Math.PI * t / duration); // Simple envelope
			channelData[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * volume;
		}

		// Convert to WAV blob and create Babylon.js Sound
		const wavBlob = this.audioBufferToWav(audioBuffer);
		const url = URL.createObjectURL(wavBlob);
		
		return new BABYLON.Sound("beep", url, this.scene, null, {
			volume: volume,
			playbackRate: 1.0,
			loop: false
		});
	}

	private createChordSound(frequencies: number[], duration: number, volume: number): BABYLON.Sound {
		const sampleRate = 44100;
		const numSamples = sampleRate * duration;
		const audioBuffer = this.audioContext!.createBuffer(1, numSamples, sampleRate);
		const channelData = audioBuffer.getChannelData(0);

		// Generate chord (multiple frequencies)
		for (let i = 0; i < numSamples; i++) {
			const t = i / sampleRate;
			const envelope = Math.sin(Math.PI * t / duration); // Simple envelope
			
			let sample = 0;
			frequencies.forEach(freq => {
				sample += Math.sin(2 * Math.PI * freq * t) / frequencies.length;
			});
			
			channelData[i] = sample * envelope * volume;
		}

		const wavBlob = this.audioBufferToWav(audioBuffer);
		const url = URL.createObjectURL(wavBlob);
		
		return new BABYLON.Sound("chord", url, this.scene, null, {
			volume: volume,
			playbackRate: 1.0,
			loop: false
		});
	}

	private audioBufferToWav(audioBuffer: AudioBuffer): Blob {
		const numChannels = audioBuffer.numberOfChannels;
		const sampleRate = audioBuffer.sampleRate;
		const format = 1; // PCM
		const bitDepth = 16;

		const bytesPerSample = bitDepth / 8;
		const blockAlign = numChannels * bytesPerSample;
		const byteRate = sampleRate * blockAlign;
		const dataLength = audioBuffer.length * blockAlign;

		const buffer = new ArrayBuffer(44 + dataLength);
		const view = new DataView(buffer);

		// WAV header
		const writeString = (offset: number, string: string) => {
			for (let i = 0; i < string.length; i++) {
				view.setUint8(offset + i, string.charCodeAt(i));
			}
		};

		writeString(0, 'RIFF');
		view.setUint32(4, 36 + dataLength, true);
		writeString(8, 'WAVE');
		writeString(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, format, true);
		view.setUint16(22, numChannels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, byteRate, true);
		view.setUint16(32, blockAlign, true);
		view.setUint16(34, bitDepth, true);
		writeString(36, 'data');
		view.setUint32(40, dataLength, true);

		// Convert float samples to PCM
		const channelData = audioBuffer.getChannelData(0);
		let offset = 44;
		for (let i = 0; i < channelData.length; i++) {
			const sample = Math.max(-1, Math.min(1, channelData[i]));
			view.setInt16(offset, sample * 0x7FFF, true);
			offset += 2;
		}

		return new Blob([buffer], { type: 'audio/wav' });
	}

	private playBoundaryHitSound(): void {
		const currentTime = Date.now();
		
		// Prevent sound spam by using cooldown
		if (currentTime - this.lastBoundaryHitTime < this.boundaryHitCooldown) {
			return;
		}
		
		this.playDirectBeep(800, 0.1, 0.3); // Sharp beep: 800Hz, 0.1s, 30% volume
		this.lastBoundaryHitTime = currentTime;
		console.log("🔊 Boundary hit sound played");
	}

	public playBallHitSound(): void {
		const currentTime = Date.now();
		
		// Prevent sound spam by using cooldown
		if (currentTime - this.lastBallHitTime < this.ballHitCooldown) {
			return;
		}
		
		this.playDirectBeep(400, 0.15, 0.4); // Pong sound: 400Hz, 0.15s, 40% volume
		this.lastBallHitTime = currentTime;
		console.log("🔊 Ball hit paddle sound played");
	}

	public playBallWallBounceSound(): void {
		this.playDirectBeep(600, 0.1, 0.25); // Wall bounce: 600Hz, 0.1s, 25% volume
		console.log("🔊 Ball wall bounce sound played");
	}

	public playScoreSound(): void {
		this.playDirectChord([523, 659, 784], 0.8, 0.5); // Score chord: C-E-G, 0.8s, 50% volume
		console.log("🔊 Score sound played");
	}

	private playPauseSound(): void {
		this.playDirectBeep(200, 0.2, 0.2); // Pause tone: 200Hz, 0.2s, 20% volume
		console.log("🔊 Pause sound played");
	}

	private testSimpleBeep(): void {
		// Test a simple direct Web Audio API beep
		if (!this.audioContext) {
			console.log("⚠️ No audio context available");
			return;
		}
		
		try {
			console.log("🔊 Testing simple Web Audio API beep...");
			console.log("🔊 Audio context state:", this.audioContext.state);
			
			// Create a simple oscillator
			const oscillator = this.audioContext.createOscillator();
			const gainNode = this.audioContext.createGain();
			
			oscillator.connect(gainNode);
			gainNode.connect(this.audioContext.destination);
			
			oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4 note
			oscillator.type = 'sine';
			
			gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
			
			oscillator.start(this.audioContext.currentTime);
			oscillator.stop(this.audioContext.currentTime + 0.5);
			
			console.log("🔊 Simple beep test - should hear a 440Hz tone");
		} catch (error) {
			console.error("⚠️ Simple beep test failed:", error);
		}
	}

	private playDirectBeep(frequency: number, duration: number, volume: number): void {
		if (!this.audioContext) {
			console.warn("⚠️ No audio context available for beep");
			return;
		}
		
		console.log(`🔊 Playing beep: ${frequency}Hz, ${duration}s, ${volume} volume, context state: ${this.audioContext.state}`);
		
		try {
			const oscillator = this.audioContext.createOscillator();
			const gainNode = this.audioContext.createGain();
			
			oscillator.connect(gainNode);
			gainNode.connect(this.audioContext.destination);
			
			oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
			oscillator.type = 'sine';
			
			// Create envelope for more natural sound
			gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
			gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
			gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
			
			oscillator.start(this.audioContext.currentTime);
			oscillator.stop(this.audioContext.currentTime + duration);
			console.log(`✅ Beep oscillator started successfully`);
		} catch (error) {
			console.warn("⚠️ Failed to play beep:", error);
		}
	}

	private playDirectChord(frequencies: number[], duration: number, volume: number): void {
		if (!this.audioContext) return;
		
		try {
			// Play multiple frequencies simultaneously to create a chord
			frequencies.forEach(frequency => {
				const oscillator = this.audioContext!.createOscillator();
				const gainNode = this.audioContext!.createGain();
				
				oscillator.connect(gainNode);
				gainNode.connect(this.audioContext!.destination);
				
				oscillator.frequency.setValueAtTime(frequency, this.audioContext!.currentTime);
				oscillator.type = 'sine';
				
				// Reduce volume per oscillator to prevent clipping
				const adjustedVolume = volume / frequencies.length;
				gainNode.gain.setValueAtTime(0, this.audioContext!.currentTime);
				gainNode.gain.linearRampToValueAtTime(adjustedVolume, this.audioContext!.currentTime + 0.01);
				gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + duration);
				
				oscillator.start(this.audioContext!.currentTime);
				oscillator.stop(this.audioContext!.currentTime + duration);
			});
		} catch (error) {
			console.warn("⚠️ Failed to play chord:", error);
		}
	}

	private async loadAssets(): Promise<void> {
		console.log("📦 Loading game assets...");
		
		try {
			const container = await BABYLON.SceneLoader.LoadAssetContainerAsync("/models/", "game.glb", this.scene);
			container.addAllToScene();
			console.log("📦 Assets loaded successfully");
			
			this.initializeGameObjects();
			this.positionObjects();
			this.createStrongLightingForGameObjects();
			this.createInvisibleWalls();
			this.setupPaddleControls();
			this.initializeBallSystem();
			
		} catch (error) {
			console.log("🔍 Trying alternative path...");
			try {
				const container = await BABYLON.SceneLoader.LoadAssetContainerAsync("/models/", "", this.scene);
				container.addAllToScene();
				console.log("📦 Assets loaded with alternative path");
				
				this.initializeGameObjects();
				this.positionObjects();
				this.createStrongLightingForGameObjects();
				this.createInvisibleWalls();
				this.setupPaddleControls();
				this.initializeBallSystem();
				
			} catch (err2) {
				console.error("❌ Failed to load assets:", err2);
			}
		}
	}

	private initializeGameObjects(): void {
		const leftPaddleMesh = this.scene.getMeshByName('paddleLeft');
		const rightPaddleMesh = this.scene.getMeshByName('paddleRight');
		const ballMesh = this.scene.getMeshByName('pongBall');

		if (leftPaddleMesh) {
			this.gameObjects.set('leftPaddle', new GameObject3D(leftPaddleMesh, 'paddle'));
		}
		if (rightPaddleMesh) {
			this.gameObjects.set('rightPaddle', new GameObject3D(rightPaddleMesh, 'paddle'));
		}
		if (ballMesh) {
			this.gameObjects.set('ball', new GameObject3D(ballMesh, 'ball'));
		}
		
		console.log(`🎯 Initialized ${this.gameObjects.size} game objects`);
	}

	private positionObjects(): void {
		const objectPositions: { [key: string]: BABYLON.Vector3 } = {
			'paddleLeft': new BABYLON.Vector3(-20.28, 1.00, 0.00),
			'pongBall': new BABYLON.Vector3(0.00, 0.78, 0.00),
			'centreLine': new BABYLON.Vector3(0.00, 0.05, 0.00),
			'paddleRight': new BABYLON.Vector3(20.28, 1.00, 0.00),
			'floorPlane': new BABYLON.Vector3(0.00, 0.00, 0.00)
		};

		Object.keys(objectPositions).forEach(meshName => {
			const mesh = this.scene.getMeshByName(meshName);
			if (mesh) {
				const pos = objectPositions[meshName];
				mesh.position.copyFrom(pos);
				console.log(`📍 Positioned ${meshName} at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
			}
		});
	}

	private createStrongLightingForGameObjects(): void {
		const paddleLeft = this.scene.getMeshByName('paddleLeft');
		const paddleRight = this.scene.getMeshByName('paddleRight');
		
		if (paddleLeft) {
			this.makePaddleEmitLight(paddleLeft, new BABYLON.Color3(0.2, 0.8, 1.0), 'left');
		}
		
		if (paddleRight) {
			this.makePaddleEmitLight(paddleRight, new BABYLON.Color3(1.0, 0.4, 0.1), 'right');
		}
		
		console.log("💡 Strong light emission system created for paddles");
	}





	private togglePause(): void {
		this.isPaused = !this.isPaused;
		
		if (this.isPaused) {
			this.guiManager.createPauseMenu();
			this.playPauseSound();
			console.log("⏸️ Game paused");
		} else {
			this.guiManager.removePauseMenu();
			this.playPauseSound();
			console.log("▶️ Game resumed");
		}
	}

	private setupPaddleControls(): void {
		const inputMap: { [key: string]: boolean } = {};
		
		// Check if paddles exist
		const leftPaddle = this.scene.getMeshByName('paddleLeft');
		const rightPaddle = this.scene.getMeshByName('paddleRight');
		
		console.log("🎮 Setting up paddle controls:");
		console.log("  Left paddle found:", !!leftPaddle);
		console.log("  Right paddle found:", !!rightPaddle);
		
		if (!leftPaddle || !rightPaddle) {
			console.error("❌ Paddles not found in scene! Available meshes:");
			this.scene.meshes.forEach(mesh => {
				console.log(`  - ${mesh.name}`);
			});
			return;
		}
	}

	private createInvisibleWalls(): void {
		const floorPlane = this.scene.getMeshByName('floorPlane');
		
		if (!floorPlane) {
			console.warn("⚠️ Floor plane not found, using default boundaries");
			return;
		}

		console.log("🚧 Creating invisible walls at floor edges...");
		
		// Force bounding box recalculation to get current world coordinates
		floorPlane.computeWorldMatrix(true);
		floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
		
		const boundingInfo = floorPlane.getBoundingInfo();
		const boundingBox = boundingInfo.boundingBox;
		
		// Get floor dimensions and position
		const floorMinZ = boundingBox.minimumWorld.z;
		const floorMaxZ = boundingBox.maximumWorld.z;
		const floorMinX = boundingBox.minimumWorld.x;
		const floorMaxX = boundingBox.maximumWorld.x;
		const floorY = boundingBox.maximumWorld.y; // Top surface of floor
		
		console.log(`🚧 Floor bounds - Z: ${floorMinZ.toFixed(2)} to ${floorMaxZ.toFixed(2)}, X: ${floorMinX.toFixed(2)} to ${floorMaxX.toFixed(2)}`);
		
		// Wall dimensions
		const wallHeight = 5.0; // High enough for paddles
		const wallThickness = 0.1; // Thin walls
		const wallWidth = Math.abs(floorMaxX - floorMinX) + 2; // Cover full floor width plus buffer
		
		// Create forward wall (at maxZ edge)
		const forwardWall = BABYLON.MeshBuilder.CreateBox("forwardWall", {
			width: wallWidth,
			height: wallHeight,
			depth: wallThickness
		}, this.scene);
		
		// Position at forward edge of floor, snapped to surface
		forwardWall.position = new BABYLON.Vector3(
			(floorMinX + floorMaxX) / 2, // Center X
			floorY + (wallHeight / 2), // Bottom at floor surface
			floorMaxZ + (wallThickness / 2) // Just outside floor edge
		);
		
		// Create backward wall (at minZ edge)
		const backwardWall = BABYLON.MeshBuilder.CreateBox("backwardWall", {
			width: wallWidth,
			height: wallHeight,
			depth: wallThickness
		}, this.scene);
		
		// Position at backward edge of floor, snapped to surface
		backwardWall.position = new BABYLON.Vector3(
			(floorMinX + floorMaxX) / 2, // Center X
			floorY + (wallHeight / 2), // Bottom at floor surface
			floorMinZ - (wallThickness / 2) // Just outside floor edge
		);
		
		// Make walls invisible but still detectable by raycasting
		const invisibleMaterial = new BABYLON.StandardMaterial("invisibleWallMaterial", this.scene);
		invisibleMaterial.alpha = 0.0; // Completely transparent
		invisibleMaterial.disableLighting = true;
		
		forwardWall.material = invisibleMaterial;
		backwardWall.material = invisibleMaterial;
		
		// Make walls pickable for raycasting but not for mouse clicks
		forwardWall.isPickable = true;
		backwardWall.isPickable = true;
		forwardWall.checkCollisions = false;
		backwardWall.checkCollisions = false;
		
		
		console.log(`🚧 Created invisible walls:`);
		console.log(`  Forward wall at Z: ${forwardWall.position.z.toFixed(2)} (boundary: ${floorMaxZ.toFixed(2)})`);
		console.log(`  Backward wall at Z: ${backwardWall.position.z.toFixed(2)} (boundary: ${floorMinZ.toFixed(2)})`);
		console.log(`✅ Invisible walls created and snapped to floor edges`);
	}


private updatePaddlePosition(paddle: BABYLON.AbstractMesh, inputDirection: number): void {
	if (inputDirection === 0) return; // No movement needed
	
	const moveSpeed = 0.2;
	const oldZ = paddle.position.z;
	
	// Get paddle dimensions first
	paddle.computeWorldMatrix(true);
	paddle.getBoundingInfo().update(paddle.getWorldMatrix());
	const paddleBounds = paddle.getBoundingInfo().boundingBox;
	
	// Calculate paddle dimensions
	const paddleWidth = Math.abs(paddleBounds.maximumWorld.x - paddleBounds.minimumWorld.x);
	const paddleHeight = Math.abs(paddleBounds.maximumWorld.y - paddleBounds.minimumWorld.y);
	const paddleDepth = Math.abs(paddleBounds.maximumWorld.z - paddleBounds.minimumWorld.z);
	
	// Calculate new intended position
	const moveDirection = new BABYLON.Vector3(0, 0, inputDirection * moveSpeed);
	const intendedNewPosition = paddle.position.add(moveDirection);
	
	console.log(`🎯 ${paddle.name} attempting move: ${oldZ.toFixed(2)} → ${intendedNewPosition.z.toFixed(2)} (input: ${inputDirection})`);
	console.log(`📏 Paddle dimensions - Width: ${paddleWidth.toFixed(2)}, Height: ${paddleHeight.toFixed(2)}, Depth: ${paddleDepth.toFixed(2)}`);
	
	// Cast rays from CURRENT paddle position, not intended position
	// This prevents premature collision detection
	const currentLeadingEdgeZ = inputDirection > 0 ? 
		paddle.position.z + (paddleDepth / 2) :  // Current front edge
		paddle.position.z - (paddleDepth / 2);   // Current back edge
		
	console.log(`🎯 Casting rays from current leading edge at Z: ${currentLeadingEdgeZ.toFixed(2)}`);
	
	// Create ray starting positions at the CURRENT leading edge of the paddle
	const rayStartPositions = [
		// Center of current leading edge
		new BABYLON.Vector3(paddle.position.x, paddle.position.y, currentLeadingEdgeZ),
		
		// Left and right edges of paddle at current leading face
		new BABYLON.Vector3(paddle.position.x - (paddleWidth / 2) + 0.1, paddle.position.y, currentLeadingEdgeZ),
		new BABYLON.Vector3(paddle.position.x + (paddleWidth / 2) - 0.1, paddle.position.y, currentLeadingEdgeZ),
		
		// Top and bottom edges at current leading face
		new BABYLON.Vector3(paddle.position.x, paddle.position.y + (paddleHeight / 2) - 0.1, currentLeadingEdgeZ),
		new BABYLON.Vector3(paddle.position.x, paddle.position.y - (paddleHeight / 2) + 0.1, currentLeadingEdgeZ),
		
		// Corner points of current leading face
		new BABYLON.Vector3(paddle.position.x - (paddleWidth / 2) + 0.1, paddle.position.y + (paddleHeight / 2) - 0.1, currentLeadingEdgeZ),
		new BABYLON.Vector3(paddle.position.x + (paddleWidth / 2) - 0.1, paddle.position.y + (paddleHeight / 2) - 0.1, currentLeadingEdgeZ),
		new BABYLON.Vector3(paddle.position.x + (paddleWidth / 2) - 0.1, paddle.position.y - (paddleHeight / 2) + 0.1, currentLeadingEdgeZ)
	];
	
	// Ray direction: continue in movement direction from current leading edge
	const rayDirection = new BABYLON.Vector3(0, 0, inputDirection).normalize();
	const rayDistance = moveSpeed + 0.01; // Just slightly more than move distance
	
	let collisionDetected = false;
	let closestDistance = Infinity;
	let hitWallName = "";
	
	// Enable ray visualization for debugging
	// this.debugVisualizeRays(rayStartPositions, rayDirection, rayDistance);
	
	// Cast rays from all positions on the leading edge
	rayStartPositions.forEach((rayStart, index) => {
		const ray = new BABYLON.Ray(rayStart, rayDirection, rayDistance);
		const hit = this.scene.pickWithRay(ray);
		
		if (hit?.hit && hit.pickedMesh && 
			(hit.pickedMesh.name === "forwardWall" || hit.pickedMesh.name === "backwardWall")) {
			
			collisionDetected = true;
			if (hit.distance < closestDistance) {
				closestDistance = hit.distance;
				hitWallName = hit.pickedMesh.name;
			}
			console.log(`🔍 Ray ${index} from leading edge hit ${hit.pickedMesh.name} at distance ${hit.distance.toFixed(3)}`);
		}
	});
	
	// Alternative approach: Check if the paddle would go beyond floor edges
	if (!collisionDetected) {
		// Get floor bounds for precise edge detection
		const floorPlane = this.scene.getMeshByName('floorPlane');
		if (floorPlane) {
			floorPlane.computeWorldMatrix(true);
			floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
			const floorBounds = floorPlane.getBoundingInfo().boundingBox;
			
			// Calculate where the leading edge WOULD BE after the move
			const newLeadingEdgeZ = inputDirection > 0 ? 
				intendedNewPosition.z + (paddleDepth / 2) :  // Moving forward: front edge after move
				intendedNewPosition.z - (paddleDepth / 2);   // Moving backward: back edge after move
			
			// Use minimal buffer - just enough to keep paddle on the floor surface
			const minimalBuffer = 0.01; // Even smaller buffer for precise edge alignment
			const maxFloorZ = floorBounds.maximumWorld.z - minimalBuffer;
			const minFloorZ = floorBounds.minimumWorld.z + minimalBuffer;
			
			console.log(`🏢 Floor Z bounds: ${minFloorZ.toFixed(3)} to ${maxFloorZ.toFixed(3)} (buffer: ${minimalBuffer})`);
			console.log(`🎯 Leading edge would be at: ${newLeadingEdgeZ.toFixed(3)} after move`);
			
			// Check if leading edge would go beyond floor boundaries AFTER the move
			if (inputDirection > 0 && newLeadingEdgeZ > maxFloorZ) {
				// Moving forward: check if leading edge exceeds floor
				collisionDetected = true;
				hitWallName = "forwardWall";
				console.log(`🚧 ${paddle.name} leading edge would exceed floor: ${newLeadingEdgeZ.toFixed(3)} > ${maxFloorZ.toFixed(3)}`);
			} else if (inputDirection < 0 && newLeadingEdgeZ < minFloorZ) {
				// Moving backward: check if leading edge exceeds floor  
				collisionDetected = true;
				hitWallName = "backwardWall";
				console.log(`🚧 ${paddle.name} leading edge would exceed floor: ${newLeadingEdgeZ.toFixed(3)} < ${minFloorZ.toFixed(3)}`);
			}
		}
	}
	
	// If still no collision detected, do a final precise boundary check
	if (!collisionDetected) {
		const floorPlane = this.scene.getMeshByName('floorPlane');
		if (floorPlane) {
			floorPlane.computeWorldMatrix(true);
			floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
			const floorBounds = floorPlane.getBoundingInfo().boundingBox;
			
			// Check if ANY part of the paddle would go off the floor
			const paddleBackEdge = inputDirection > 0 ? 
				intendedNewPosition.z - (paddleDepth / 2) :  // Moving forward: check back edge stays on
				intendedNewPosition.z + (paddleDepth / 2);   // Moving backward: check back edge stays on
				
			const paddleFrontEdge = inputDirection > 0 ? 
				intendedNewPosition.z + (paddleDepth / 2) :  // Moving forward: check front edge doesn't exceed
				intendedNewPosition.z - (paddleDepth / 2);   // Moving backward: check front edge doesn't exceed
			
			// Ensure entire paddle stays within floor bounds
			if (paddleFrontEdge > floorBounds.maximumWorld.z || 
				paddleFrontEdge < floorBounds.minimumWorld.z ||
				paddleBackEdge > floorBounds.maximumWorld.z || 
				paddleBackEdge < floorBounds.minimumWorld.z) {
				
				collisionDetected = true;
				hitWallName = inputDirection > 0 ? "forwardWall" : "backwardWall";
				console.log(`🚧 ${paddle.name} would partially leave floor - front: ${paddleFrontEdge.toFixed(2)}, back: ${paddleBackEdge.toFixed(2)}`);
				console.log(`🚧 Floor bounds: ${floorBounds.minimumWorld.z.toFixed(2)} to ${floorBounds.maximumWorld.z.toFixed(2)}`);
			}
		}
	}
	
	// Apply movement based on collision detection
	if (collisionDetected) {
		console.log(`🚧 ${paddle.name} blocked by ${hitWallName} - staying at Z: ${paddle.position.z.toFixed(2)}`);
		this.playBoundaryHitSound();
		// Don't move - collision detected
	} else {
		// Safe to move
		paddle.position.z = intendedNewPosition.z;
		console.log(`✅ ${paddle.name} moved safely to Z: ${intendedNewPosition.z.toFixed(2)}`);
	}
}

// Debugging method - visualize rays and boundaries
private debugVisualizeRays(rayPositions: BABYLON.Vector3[], rayDirection: BABYLON.Vector3, rayDistance: number): void {
	// Enable this for debugging
	const DEBUG_RAYS = true;
	if (!DEBUG_RAYS) return;
	
	rayPositions.forEach((start, index) => {
		const end = start.add(rayDirection.scale(rayDistance));
		
		// Create a thin line to visualize the ray
		const rayLine = BABYLON.MeshBuilder.CreateLines(`debugRay_${index}`, {
			points: [start, end]
		}, this.scene);
		
		rayLine.color = BABYLON.Color3.Red();
		
		// Remove after longer time to see them better
		setTimeout(() => {
			rayLine.dispose();
		}, 2000);
	});
	
	// Also visualize floor boundaries for debugging
	this.debugVisualizeFloorBounds();
}

private debugVisualizeFloorBounds(): void {
	const floorPlane = this.scene.getMeshByName('floorPlane');
	if (!floorPlane) return;
	
	floorPlane.computeWorldMatrix(true);
	floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
	const floorBounds = floorPlane.getBoundingInfo().boundingBox;
	
	console.log(`🏢 Floor bounds - X: ${floorBounds.minimumWorld.x.toFixed(2)} to ${floorBounds.maximumWorld.x.toFixed(2)}`);
	console.log(`🏢 Floor bounds - Y: ${floorBounds.minimumWorld.y.toFixed(2)} to ${floorBounds.maximumWorld.y.toFixed(2)}`);
	console.log(`🏢 Floor bounds - Z: ${floorBounds.minimumWorld.z.toFixed(2)} to ${floorBounds.maximumWorld.z.toFixed(2)}`);
	
	// Create visual markers at floor corners for debugging
	const floorY = floorBounds.maximumWorld.y + 0.1; // Slightly above floor
	const cornerHeight = 0.5;
	
	// Front-left corner
	const frontLeft = BABYLON.MeshBuilder.CreateBox("debug_frontLeft", {
		width: 0.1, height: cornerHeight, depth: 0.1
	}, this.scene);
	frontLeft.position = new BABYLON.Vector3(floorBounds.minimumWorld.x, floorY + cornerHeight/2, floorBounds.maximumWorld.z);
	frontLeft.material = new BABYLON.StandardMaterial("debugMat", this.scene);
	(frontLeft.material as BABYLON.StandardMaterial).diffuseColor = BABYLON.Color3.Yellow();
	
	// Front-right corner  
	const frontRight = BABYLON.MeshBuilder.CreateBox("debug_frontRight", {
		width: 0.1, height: cornerHeight, depth: 0.1
	}, this.scene);
	frontRight.position = new BABYLON.Vector3(floorBounds.maximumWorld.x, floorY + cornerHeight/2, floorBounds.maximumWorld.z);
	frontRight.material = frontLeft.material;
	
	// Back-left corner
	const backLeft = BABYLON.MeshBuilder.CreateBox("debug_backLeft", {
		width: 0.1, height: cornerHeight, depth: 0.1
	}, this.scene);
	backLeft.position = new BABYLON.Vector3(floorBounds.minimumWorld.x, floorY + cornerHeight/2, floorBounds.minimumWorld.z);
	backLeft.material = frontLeft.material;
	
	// Back-right corner
	const backRight = BABYLON.MeshBuilder.CreateBox("debug_backRight", {
		width: 0.1, height: cornerHeight, depth: 0.1
	}, this.scene);
	backRight.position = new BABYLON.Vector3(floorBounds.maximumWorld.x, floorY + cornerHeight/2, floorBounds.minimumWorld.z);
	backRight.material = frontLeft.material;
	
	// Remove debug markers after some time
	setTimeout(() => {
		frontLeft.dispose();
		frontRight.dispose();
		backLeft.dispose();
		backRight.dispose();
	}, 5000);
}

	private setupStrongLightSystem(): void {
		// We'll create strong emissive lighting after the GLB is loaded
		console.log("💡 Preparing strong light emission system with shadows");
	}

	private makePaddleEmitLight(parentMesh: BABYLON.AbstractMesh, lightColor: BABYLON.Color3, side: string): void {
		const emissiveMaterial = new BABYLON.PBRMaterial(`${parentMesh.name}_emissive`, this.scene);
		
		if (side === 'left') {
			emissiveMaterial.albedoColor = new BABYLON.Color3(0.05, 0.15, 0.20);
		} else {
			emissiveMaterial.albedoColor = new BABYLON.Color3(0.20, 0.08, 0.02);
		}
		
		emissiveMaterial.emissiveColor = lightColor;
		emissiveMaterial.emissiveIntensity = 2.0;
		emissiveMaterial.roughness = 0.1;
		emissiveMaterial.metallicF0Factor = 0.8;
		
		parentMesh.material = emissiveMaterial;
		
		const lightOffset = new BABYLON.Vector3(0, 0.5, 0);
		const strongLight = new BABYLON.PointLight(`${parentMesh.name}_strongLight`, parentMesh.position.add(lightOffset), this.scene);
		
		strongLight.diffuse = lightColor;
		strongLight.specular = lightColor;
		strongLight.intensity = 15.0;
		strongLight.range = 50.0;
		strongLight.falloffType = BABYLON.PointLight.FALLOFF_PHYSICAL;
		
		strongLight.parent = parentMesh;
		strongLight.position.copyFrom(lightOffset);
		
		const shadowGenerator = new BABYLON.ShadowGenerator(1024, strongLight);
		shadowGenerator.useBlurExponentialShadowMap = true;
		shadowGenerator.blurKernel = 4;
		shadowGenerator.bias = 0.0001;
		shadowGenerator.setDarkness(0.8);
		
		this.scene.meshes.forEach(mesh => {
			if (mesh.name !== "skybox" && mesh !== parentMesh) {
				shadowGenerator.addShadowCaster(mesh);
			}
		});
		
		const floorPlane = this.scene.getMeshByName('floorPlane');
		if (floorPlane) {
			floorPlane.receiveShadows = true;
		}
		
		this.createLightBlocker(parentMesh, side);
	}

	private createLightBlocker(parentMesh: BABYLON.AbstractMesh, side: string): void {
		const blockerDistance = 6.0;
		const blockerPositions = [
			new BABYLON.Vector3(0, 0, blockerDistance),
			new BABYLON.Vector3(0, 0, -blockerDistance),
			new BABYLON.Vector3(side === 'left' ? blockerDistance : -blockerDistance, 0, 0),
		];
		
		blockerPositions.forEach((offset, index) => {
			const blocker = BABYLON.MeshBuilder.CreatePlane(`${parentMesh.name}_lightBlocker_${index}`, {
				size: 15
			}, this.scene);
			
			blocker.position = parentMesh.position.add(offset);
			
			const blockerMaterial = new BABYLON.StandardMaterial(`${parentMesh.name}_blockerMaterial_${index}`, this.scene);
			blockerMaterial.alpha = 0.0;
			blockerMaterial.disableLighting = true;
			blocker.material = blockerMaterial;
			
			blocker.isPickable = false;
			blocker.checkCollisions = false;
			blocker.parent = parentMesh;
			blocker.position.copyFrom(offset);
			
			if (Math.abs(offset.z) > Math.abs(offset.x)) {
				blocker.rotation.y = offset.z > 0 ? 0 : Math.PI;
			} else {
				blocker.rotation.y = offset.x > 0 ? -Math.PI/2 : Math.PI/2;
			}
		});
	}



	private createBackgroundLayers(): void {
		this.createSkybox();
	}

	private createSkybox(): void {
		// Create a large cube that surrounds the entire scene - better for rectangular textures
		const skybox = BABYLON.MeshBuilder.CreateBox("skybox", {size: 1000}, this.scene);
		
		// Create skybox material
		const skyboxMaterial = new BABYLON.StandardMaterial("skyboxMaterial", this.scene);
		skyboxMaterial.backFaceCulling = false; // Render inside faces
		
		// Use diffuse texture instead of reflection for proper UV mapping
		skyboxMaterial.diffuseTexture = new BABYLON.Texture("/textures/starfield.png", this.scene);
		skyboxMaterial.diffuseTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
		skyboxMaterial.diffuseTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
		
		// Set emissive to make it glow without lighting
		skyboxMaterial.emissiveTexture = skyboxMaterial.diffuseTexture;
		skyboxMaterial.emissiveColor = new BABYLON.Color3(1.0, 1.0, 1.0); // White to preserve original colors
		
		skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0); // No specular lighting
		skyboxMaterial.disableLighting = true; // Disable lighting calculations
		
		skybox.material = skyboxMaterial;
		skybox.infiniteDistance = true; // Always render at infinite distance
		
		// Make sure skybox moves with camera but ignores translation
		skybox.parent = this.scene.activeCamera;
		
		// Add rotation animation for moving stars effect
		this.scene.registerBeforeRender(() => {
			skybox.rotation.y += 0.001; // Increased rotation speed
		});
	}

	private initializeBallSystem(): void {
		const ball = this.scene.getMeshByName('pongBall');
		if (!ball) {
			console.warn("⚠️ Ball not found in scene");
			return;
		}
	}

	/**
	 * Update ball position and velocity for remote multiplayer sync
	 */
	public updateBallPosition(x: number, y: number, vx: number, vy: number): void {
		const ballObject = this.gameObjects.get('ball');
		if (!ballObject || !ballObject.mesh) return;

		// Convert backend 2D coordinates to 3D coordinates
		// Backend uses 0-800 (x) and 0-600 (y), we need to map to our 3D space
		const ballMesh = ballObject.mesh;
		
		// Map backend coordinates to 3D space
		// Backend: x=0-800 maps to X=-20 to +20 in 3D
		// Backend: y=0-600 maps to Z=+15 to -15 in 3D (INVERTED for correct orientation)
		ballMesh.position.x = ((x / 800) * 40) - 20; // Map 0-800 to -20 to +20
		ballMesh.position.z = 15 - ((y / 600) * 30); // Map 0-600 to +15 to -15 (INVERTED)
		
		// Update velocity for future predictions/smoothing
		this.ballVelocity.x = (vx / 800) * 40; // Scale velocity accordingly
		this.ballVelocity.z = -(vy / 600) * 30; // Invert Z velocity to match coordinate system
	}

	/**
	 * Update paddle positions for remote multiplayer sync
	 */
	public updatePaddlePositions(paddle1Y: number, paddle2Y: number): void {
		const leftPaddle = this.gameObjects.get('leftPaddle');
		const rightPaddle = this.gameObjects.get('rightPaddle');
		
		// Clamp backend paddle Y coordinates to valid range (0-500, accounting for paddle height)
		const clampedPaddle1Y = Math.max(0, Math.min(500, paddle1Y));
		const clampedPaddle2Y = Math.max(0, Math.min(500, paddle2Y));
		
		if (leftPaddle && leftPaddle.mesh) {
			// Map backend paddle Y (0-500) to 3D Z (+12 to -12) - INVERTED for correct controls
			const newLeftZ = 12 - ((clampedPaddle1Y / 500) * 24);
			// Additional safety clamp for 3D coordinates to ensure paddle stays on plane
			const finalLeftZ = Math.max(-12, Math.min(12, newLeftZ));
			leftPaddle.mesh.position.z = finalLeftZ;
		}
		
		if (rightPaddle && rightPaddle.mesh) {
			// Map backend paddle Y (0-500) to 3D Z (+12 to -12) - INVERTED for correct controls
			const newRightZ = 12 - ((clampedPaddle2Y / 500) * 24);
			// Additional safety clamp for 3D coordinates to ensure paddle stays on plane
			const finalRightZ = Math.max(-12, Math.min(12, newRightZ));
			rightPaddle.mesh.position.z = finalRightZ;
		}
	}

	public dispose(): void {
		// Dispose audio resources
		if (this.audioContext) this.audioContext.close();
		
		this.guiManager.dispose();
		this.scene.dispose();
		this.engine.dispose();
	}

	private setupResizeListener(): void {
		window.addEventListener("resize", () => {
			this.engine.resize();
		});
	}

	getGameObject(name: string): GameObject3D | undefined {
		return this.gameObjects.get(name);
	}

	getMesh(name: string): BABYLON.AbstractMesh | null {
		return this.scene.getMeshByName(name);
	}

	getScene(): BABYLON.Scene {
		return this.scene;
	}

	update(deltaTime: number): void {
		this.gameObjects.forEach(obj => obj.update(deltaTime));
	}

	render(): void {
		// Rendering is handled by the engine's render loop
	}
}