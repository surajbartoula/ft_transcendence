// src/main.ts
import { Engine } from "@babylonjs/core";
import { SceneManager } from "./sceneManager"; // .ts extension omitted for import

/**
 * Main function to initialize the Babylon.js application.
 */
async function initializeBabylonApp(): Promise<void> {
    // 1. Get the canvas element from the HTML
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    if (!canvas) {
        console.error("Canvas element 'renderCanvas' not found!");
        return;
    }

    // 2. Create the Babylon.js Engine
    const engine = new Engine(canvas, true);

    // 3. Create an instance of your SceneManager
    const sceneManager = new SceneManager(engine, canvas);

    // 4. Create the actual scene
    const scene = await sceneManager.createScene();

    // 5. Register a render loop to repeatedly render the scene
    engine.runRenderLoop(() => {
        if (scene.isReady()) { // Ensure scene is ready before rendering
            scene.render();
        }
    });

    // 6. Handle browser/canvas resize events
    window.addEventListener("resize", () => {
        engine.resize();
    });

    console.log("Babylon.js TS app initialized!");
}

// Call the main initialization function when the window loads
window.addEventListener("DOMContentLoaded", initializeBabylonApp);