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
            if (!event.key) return; // Handle undefined key
            const key = event.key.toLowerCase();
            if (key === ' ') {
                console.log('🎯 InputManager: Space key detected in keydown, looking for handler');
                const handler = this.inputHandlers.get(key);
                console.log(`🎯 InputManager: Space handler found: ${!!handler}`);
            }
            if (!this.keyStates.get(key)) {
                this.keyStates.set(key, true);
                const handler = this.inputHandlers.get(key);
                if (handler) {
                    if (key === ' ') console.log('🎯 InputManager: Calling space handler with true');
                    handler(true);
                }
            }
        });

        window.addEventListener('keyup', (event) => {
            if (!event.key) return; // Handle undefined key
            const key = event.key.toLowerCase();
            this.keyStates.set(key, false);
            const handler = this.inputHandlers.get(key);
            if (handler) handler(false);
        });
    }

    isKeyPressed(key: string): boolean {
        if (!key) return false; // Handle undefined key
        return this.keyStates.get(key.toLowerCase()) || false;
    }

    registerHandler(key: string, handler: (pressed: boolean) => void): void {
        if (!key) return; // Handle undefined key
        const lowerKey = key.toLowerCase();
        if (lowerKey === ' ') {
            console.log('🎯 InputManager: Registering space key handler');
        }
        this.inputHandlers.set(lowerKey, handler);
        console.log(`🎯 InputManager: Registered handler for key "${lowerKey}"`);
    }

    unregisterHandler(key: string): void {
        if (!key) return; // Handle undefined key
        this.inputHandlers.delete(key.toLowerCase());
    }

    dispose(): void {
        this.inputHandlers.clear();
        this.keyStates.clear();
    }
}