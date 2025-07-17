import { Page } from '../router/Router';

export class FriendsPage implements Page {
    public title = 'Friends';
    public requiresAuth = true;

    public render(): string {
        return `
            <div class="min-h-screen bg-slate-900">
                ${this.renderSidebar()}
                <div class="ml-64 p-8">
                    <h1 class="text-3xl font-bold text-white mb-6">Friends</h1>
                    <!-- Add your friends content here -->
                    <div class="bg-slate-800 p-6 rounded-lg">
                        <p class="text-gray-300">Friends content goes here...</p>
                    </div>
                </div>
            </div>
        `;
    }

    public initialize(): void {
        console.log('Friends page initialized');
    }

    public cleanup(): void {
        console.log('Friends page cleaned up');
    }

    private renderSidebar(): string {
        return `
            <div class="fixed left-0 top-0 h-full w-64 bg-slate-800 border-r border-slate-700">
                <div class="p-6 border-b border-slate-700">
                    <h2 class="text-xl font-bold text-white">ft_transcendence</h2>
                </div>
                <nav class="p-4 space-y-2">
                    <a href="#" data-route="/dashboard" class="block p-3 rounded text-gray-300 hover:bg-slate-700">Dashboard</a>
                    <a href="#" data-route="/dashboard/profile" class="block p-3 rounded text-gray-300 hover:bg-slate-700">Profile</a>
                    <a href="#" data-route="/dashboard/leaderboard" class="block p-3 rounded text-gray-300 hover:bg-slate-700">Leaderboard</a>
                    <a href="#" data-route="/dashboard/friends" class="block p-3 rounded bg-blue-600 text-white">Friends</a>
                    <a href="#" data-route="/dashboard/settings" class="block p-3 rounded text-gray-300 hover:bg-slate-700">Settings</a>
                    <a href="#" data-route="/chat" class="block p-3 rounded text-gray-300 hover:bg-slate-700">Chat</a>
                    <a href="#" id="logoutBtn" class="block p-3 rounded text-red-400 hover:bg-red-900/20">Logout</a>
                </nav>
            </div>
        `;
    }
}
