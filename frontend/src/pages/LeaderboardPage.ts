import { Page } from '../router/Router';

export class LeaderboardPage implements Page {
    public title = 'Leaderboard';
    public requiresAuth = true;

    public render(): string {
        return `
            <div class="fixed inset-0 flex h-screen bg-slate-900">
                ${this.renderSidebar()}
                <div class="flex-1 p-8 overflow-y-auto">
                    <div class="fade-in">
                        <h2 class="text-3xl font-bold mb-6 text-white">Leaderboard</h2>
                        <div class="bg-slate-800 rounded-lg p-6">
                            <p class="text-gray-300 mb-4">Top players and rankings</p>
                            <div class="space-y-3">
                                ${Array.from({length: 10}, (_, i) => `
                                    <div class="flex items-center justify-between p-3 bg-slate-700 rounded">
                                        <div class="flex items-center space-x-3">
                                            <span class="text-lg font-bold text-yellow-500">#${i + 1}</span>
                                            <span class="text-white">Player ${i + 1}</span>
                                        </div>
                                        <span class="text-blue-400 font-semibold">${1500 - i * 50} pts</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public initialize(): void {
        console.log('Leaderboard page initialized');
    }

    public cleanup(): void {
        console.log('Leaderboard page cleaned up');
    }

    private renderSidebar(): string {
        return this.getSidebar('/dashboard/leaderboard');
    }

    private getSidebar(activeRoute: string): string {
        const navItems = [
            { route: '/dashboard', icon: '🎮', label: 'Dashboard' },
            { route: '/dashboard/profile', icon: '👤', label: 'Profile' },
            { route: '/dashboard/leaderboard', icon: '🏆', label: 'Leaderboard', active: true },
            { route: '/dashboard/settings', icon: '⚙️', label: 'Settings' },
            { route: '/chat', icon: '💬', label: 'Chat' }
        ];

        return `
            <div class="w-64 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
                <div class="p-6 border-b border-slate-700">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                            <span class="text-white font-bold text-lg">G</span>
                        </div>
                        <h1 class="text-xl font-bold text-blue-400">GameHub</h1>
                    </div>
                </div>
                
                <nav class="p-4 space-y-2 flex-1">
                    ${navItems.map(item => {
                        const isActive = item.route === activeRoute;
                        const activeClasses = isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700';
                        return `
                            <a href="#" data-route="${item.route}" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg ${activeClasses} transition-colors">
                                <span>${item.icon}</span>
                                <span>${item.label}</span>
                            </a>
                        `;
                    }).join('')}
                    
                    <a href="#" id="logoutBtn" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors">
                        <span>🚪</span>
                        <span>Logout</span>
                    </a>
                </nav>
            </div>
        `;
    }
}