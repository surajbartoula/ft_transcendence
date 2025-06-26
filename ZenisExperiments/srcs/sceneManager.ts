// src/sceneManager.ts
// Importing necessary Babylon.js classes with explicit types
import {
    Scene,
    Engine,
    ArcRotateCamera,
    Vector3,
    HemisphericLight,
    PointLight,
    MeshBuilder,
    StandardMaterial,
    Color3,
    Texture,
    AbstractMesh // Useful for type hinting when iterating over meshes
} from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/loaders/glTF";

export class SceneManager {
    private _engine: Engine;
    private _canvas: HTMLCanvasElement;
    private _scene: Scene;

    /**
     * Constructor for the SceneManager.
     * @param engine - The Babylon.js engine instance.
     * @param canvas - The HTML canvas element.
     */
    constructor(engine: Engine, canvas: HTMLCanvasElement) {
        this._engine = engine;
        this._canvas = canvas;
        // The scene is created later in createScene method
    }

    /**
     * Creates and configures the 3D scene.
     * @returns The created scene.
     */
    public async createScene(): Promise<Scene> {
        // 1. Create a new scene object
        this._scene = new Scene(this._engine);

        // 2. Add a camera
        const camera = new ArcRotateCamera(
            "mainCamera",
            Math.PI / 2,
            Math.PI / 3,
            10,
            Vector3.Zero(),
            this._scene
        );
        camera.attachControl(this._canvas, true);
        camera.setTarget(Vector3.Zero());

        // 3. Add lights
        const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this._scene);
        hemiLight.intensity = 0.7;

        const pointLight = new PointLight("pointLight", new Vector3(0, 5, -5), this._scene);
        pointLight.intensity = 0.5;

        // 4. Create 3D Meshes
        const sphere = MeshBuilder.CreateSphere("sphere", { diameter: 2, segments: 32 }, this._scene);
        sphere.position.y = 1;

        const box = MeshBuilder.CreateBox("box", { size: 2 }, this._scene);
        box.position.x = 3;
        box.position.y = 1;
        box.rotation.y = Math.PI / 4;

        const ground = MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, this._scene);
        
        // 5. Apply materials
        const sphereMaterial = new StandardMaterial("sphereMat", this._scene);
        sphereMaterial.diffuseColor = new Color3(0.8, 0.2, 0.2);
        sphere.material = sphereMaterial;

        const groundMaterial = new StandardMaterial("groundMat", this._scene);
        groundMaterial.diffuseTexture = new Texture("https://www.babylonjs-playground.com/textures/grass.png", this._scene);
        ground.material = groundMaterial;

        // 6. Load your GLB model
        // IMPORTANT: Ensure 'your_model.glb' is accessible to the web server
        // (e.g., in the same directory as index.html, or a 'public' folder)
        try {
            const loadedAssets = await SceneLoader.Append("./", "your_model.glb", this._scene);
            console.log("GLB model loaded successfully!", loadedAssets);

            // Optional: Access specific meshes after loading
            // const myLoadedMesh: AbstractMesh | undefined = loadedAssets.meshes.find(m => m.name === "mySpecificMeshNameInGLB");
            // if (myLoadedMesh) {
            //     myLoadedMesh.position.z = -5;
            // }

            // Adjust camera and light to fit the loaded scene content
            this._scene.createDefaultCameraOrLight(true, true, true);
            (this._scene.activeCamera as ArcRotateCamera).setTarget(Vector3.Zero()); // Type assertion
            (this._scene.activeCamera as ArcRotateCamera).alpha += Math.PI;
            (this._scene.activeCamera as ArcRotateCamera).radius = 15;
            
        } catch (error: any) { // Type 'any' or 'unknown' for caught errors
            console.error("Error loading GLB model:", error.message || error);
        }

        return this._scene;
    }

    /**
     * Returns the current active scene.
     * @returns The active scene.
     */
    public getScene(): Scene {
        return this._scene;
    }
}