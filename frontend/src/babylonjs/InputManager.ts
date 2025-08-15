// =====================================
// INPUT MANAGER
// =====================================
export class InputManager {
    private keyStates: Map<string, boolean> = new Map();
    private inputHandlers: Map<string, (pressed: boolean) => void> = new Map();

    initialize(): void {
        this.setupEventListeners();
        console.log("🎮 Input manager initialized");
    }

    private setupEventListeners(): void {
        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (!this.keyStates.get(key)) {
                this.keyStates.set(key, true);
                const handler = this.inputHandlers.get(key);
                if (handler) handler(true);
            }
        });

        window.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            this.keyStates.set(key, false);
            const handler = this.inputHandlers.get(key);
            if (handler) handler(false);
        });
    }

    isKeyPressed(key: string): boolean {
        return this.keyStates.get(key.toLowerCase()) || false;
    }

    registerHandler(key: string, handler: (pressed: boolean) => void): void {
        this.inputHandlers.set(key.toLowerCase(), handler);
    }

    unregisterHandler(key: string): void {
        this.inputHandlers.delete(key.toLowerCase());
    }

    dispose(): void {
        this.inputHandlers.clear();
        this.keyStates.clear();
    }
}