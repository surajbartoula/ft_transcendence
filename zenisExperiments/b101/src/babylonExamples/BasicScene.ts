import { Engine, Scene, Mesh, ArcRotateCamera, Vector3, HemisphericLight } from "@babylonjs/core";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders";

export class GLBScene {
    scene: Scene;
    engine: Engine;

    constructor(private canvas: HTMLCanvasElement) {
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine); // 🔁 Create a new scene manually

        // Optional: Add a basic light and camera if your GLB doesn't have one
        const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), this.scene);
        camera.attachControl(this.canvas, true);
        new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

        LoadAssetContainerAsync("./models/", "gameSetup.glb", this.engine).then((container) => {
            container.addAllToScene(); // Adds meshes, materials, etc. to the current scene

            // 🎯 Now access the scene's meshes
            this.scene.executeWhenReady(() => {
                this.scene.meshes.forEach(mesh => {
                    console.log("Found mesh:", mesh.name);
                });

                const myModel = this.scene.getMeshByName("MyCharacter");
                if (myModel) {
                    myModel.position.x += 1;
                    myModel.rotation.y += Math.PI / 2;
                }
            });

            this.engine.runRenderLoop(() => {
                this.scene.render();
            });
        });
    }
}
