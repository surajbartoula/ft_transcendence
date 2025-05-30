import * as BABYLON from 'babylonjs';
import * as GUI from '@babylonjs/gui';
import type { User } from './auth';
import { showLoginForm } from './ui';

let engine: BABYLON.Engine | null = null;
let scene: BABYLON.Scene | null = null;

function getCanvas(): HTMLCanvasElement | null {
    const element = document.getElementById('gameCanvas');
    return element instanceof HTMLCanvasElement ? element : null;
}

function cleanupResources(): void {
    if (scene && !scene.isDisposed) {
        scene.dispose();
        scene = null;
    }
    if (engine && !engine.isDisposed) {
        engine.dispose();
        engine = null;
    }
}

function handleLogout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    
    cleanupResources();
    showLoginForm();
}

export function showBabylonWelcome(): void {
    const canvas = getCanvas();
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    cleanupResources();

    try {
        engine = new BABYLON.Engine(canvas, true);
        scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.2, 1.0);

        // Basic camera and lighting
        const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 0, 0), scene);
        new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);

        // Create UI
        const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);

        // Welcome message
        const welcomeText = new GUI.TextBlock();
        welcomeText.text = 'Welcome!';
        welcomeText.color = 'white';
        welcomeText.fontSize = 48;
        welcomeText.top = "-100px";
        ui.addControl(welcomeText);

        // Logout button - UPDATED TO USE NEW LOGOUT FUNCTION
        const logoutButton = GUI.Button.CreateSimpleButton('logout', 'Logout');
        logoutButton.width = "120px";
        logoutButton.height = "50px";
        logoutButton.color = 'white';
        logoutButton.background = '#dc2626';
        logoutButton.fontSize = 16;
        logoutButton.top = "50px";
        logoutButton.onPointerUpObservable.add(() => {
            handleLogout(); // Use the new logout function
        });
        ui.addControl(logoutButton);

        // Start render loop
        engine.runRenderLoop(() => {
            if (scene && !scene.isDisposed) {
                scene.render();
            }
        });

        // Handle resize
        window.addEventListener('resize', () => engine?.resize());

    } catch (error) {
        console.error('Failed to initialize Babylon.js:', error);
        cleanupResources();
    }
}

export function runBabylonGame(user: User): void {
    showBabylonWelcome();
}