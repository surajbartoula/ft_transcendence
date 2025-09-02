// =====================================
// INPUT MANAGER
// =====================================
export class InputManager {
    private keyStates: Map<string, boolean> = new Map();
    private inputHandlers: Map<string, (pressed: boolean) => void> = new Map();
    private keydownHandler!: (event: KeyboardEvent) => void;
    private keyupHandler!: (event: KeyboardEvent) => void;

    initialize(): void {
        this.setupEventListeners();
        // Input manager initialized
    }

    private setupEventListeners(): void {
        this.keydownHandler = (event) => {
            if (!event.key) return; // Handle undefined key
            
            // Only handle keys on game pages
            const isGamePage = window.location.pathname.includes('/game/');
            if (!isGamePage) {
                return;
            }
            
            // Ignore key presses when user is typing in input fields
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.hasAttribute('contenteditable')
            )) {
                return;
            }
            
            const key = event.key.toLowerCase();
            if (key === ' ') {
                // Space key detected in keydown
                const handler = this.inputHandlers.get(key);
                // Space handler found
            }
            if (!this.keyStates.get(key)) {
                this.keyStates.set(key, true);
                const handler = this.inputHandlers.get(key);
                if (handler) {
                    // Calling space handler
                    handler(true);
                }
            }
        };

        this.keyupHandler = (event) => {
            if (!event.key) return; // Handle undefined key
            
            // Only handle keys on game pages
            const isGamePage = window.location.pathname.includes('/game/');
            if (!isGamePage) {
                return;
            }
            
            // Ignore key presses when user is typing in input fields
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.hasAttribute('contenteditable')
            )) {
                return;
            }
            
            const key = event.key.toLowerCase();
            this.keyStates.set(key, false);
            const handler = this.inputHandlers.get(key);
            if (handler) handler(false);
        };

        window.addEventListener('keydown', this.keydownHandler);
        window.addEventListener('keyup', this.keyupHandler);
    }

    isKeyPressed(key: string): boolean {
        if (!key) return false; // Handle undefined key
        return this.keyStates.get(key.toLowerCase()) || false;
    }

    registerHandler(key: string, handler: (pressed: boolean) => void): void {
        if (!key) return; // Handle undefined key
        const lowerKey = key.toLowerCase();
        if (lowerKey === ' ') {
            // Registering space key handler
        }
        this.inputHandlers.set(lowerKey, handler);
        // Registered handler for key
    }

    unregisterHandler(key: string): void {
        if (!key) return; // Handle undefined key
        this.inputHandlers.delete(key.toLowerCase());
    }

    dispose(): void {
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            window.removeEventListener('keyup', this.keyupHandler);
        }
        
        this.inputHandlers.clear();
        this.keyStates.clear();
        // Input manager disposed
    }
}