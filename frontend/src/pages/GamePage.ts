import { Page } from '../router/Router';

export class GamePage implements Page {
    public title = 'Game';
    public requiresAuth = true;

    public render(): string {
        return `
            <div class="min-h-screen bg-slate-900 flex items-center justify-center">
                <div class="text-center">
                    <h1 class="text-3xl font-bold text-white mb-6">Game</h1>
                    <div class="bg-slate-800 p-8 rounded-lg">
                        <p class="text-gray-300 mb-4">Game content goes here...</p>
                        <button data-route="/dashboard" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded">
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    public initialize(): void {
        console.log('Game page initialized');
    }

    public cleanup(): void {
        console.log('Game page cleaned up');
    }
}