import { Page } from '../router/Router';
import { showNotification, showError } from '../utils/ui';
import remoteTournamentService, { Tournament } from '../services/remoteTournamentService';

export class TournamentSetupPage implements Page {
    public title = 'Tournament Setup';
    public requiresAuth = true;

    private players: string[] = [];
    private maxPlayers: number = 8;
    private minPlayers: number = 2;
    private isRemoteTournament: boolean = false;
    private remoteTournaments: Tournament[] = [];

    public render(): string {
        return `
            <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900 flex flex-col">
                <!-- Header -->
                <div class="bg-slate-800 border-b border-slate-700 p-4">
                    <div class="flex items-center justify-between max-w-4xl mx-auto">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Menu</span>
                            </button>
                            <div class="h-6 w-px bg-slate-600"></div>
                            <h1 class="text-2xl font-bold text-white flex items-center">
                                <svg class="w-8 h-8 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                                Tournament Setup
                            </h1>
                        </div>
                        <div class="text-sm text-gray-400">
                            Create a tournament bracket
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 p-8">
                    <div class="max-w-6xl mx-auto">
                        <!-- Tournament Mode Selector -->
                        <div class="mb-8 bg-slate-800 rounded-lg border border-slate-700 p-6">
                            <h2 class="text-xl font-semibold text-white mb-4">Tournament Type</h2>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="tournament-mode-card cursor-pointer p-4 border border-slate-600 rounded-lg hover:border-blue-500 transition-colors" data-mode="local">
                                    <div class="flex items-center space-x-3">
                                        <div class="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 class="text-lg font-semibold text-white">Local Tournament</h3>
                                            <p class="text-sm text-gray-400">Play with friends locally</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="tournament-mode-card cursor-pointer p-4 border border-slate-600 rounded-lg hover:border-purple-500 transition-colors" data-mode="remote">
                                    <div class="flex items-center space-x-3">
                                        <div class="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 class="text-lg font-semibold text-white">Remote Tournament</h3>
                                            <p class="text-sm text-gray-400">Create or join online tournaments</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Local Tournament Setup -->
                        <div id="localTournamentSetup" class="grid lg:grid-cols-2 gap-8">
                            <!-- Left Column: Player Setup -->
                            <div class="space-y-6">
                                <!-- Tournament Info -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-xl font-semibold text-white mb-4">Tournament Information</h2>
                                    <div class="space-y-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-300 mb-2">Tournament Name</label>
                                            <input 
                                                type="text" 
                                                id="tournamentName"
                                                placeholder="Enter tournament name"
                                                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                value="Pong Tournament ${new Date().toLocaleDateString()}"
                                            >
                                        </div>
                                        <div class="grid grid-cols-2 gap-4">
                                            <div>
                                                <label class="block text-sm font-medium text-gray-300 mb-2">Min Players</label>
                                                <select id="minPlayersSelect" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                                    <option value="2">2</option>
                                                    <option value="4">4</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label class="block text-sm font-medium text-gray-300 mb-2">Max Players</label>
                                                <select id="maxPlayersSelect" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                                    <option value="4">4</option>
                                                    <option value="8" selected>8</option>
                                                    <option value="16">16</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Add Players -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-xl font-semibold text-white mb-4">Add Players</h2>
                                    <div class="space-y-4">
                                        <div class="flex space-x-2">
                                            <input 
                                                type="text" 
                                                id="playerNameInput"
                                                placeholder="Enter player name"
                                                class="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                maxlength="20"
                                            >
                                            <button 
                                                id="addPlayerButton"
                                                class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors flex items-center"
                                            >
                                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                                </svg>
                                                Add
                                            </button>
                                        </div>
                                        
                                        <!-- Quick Add Buttons -->
                                        <div class="flex flex-wrap gap-2">
                                            <button class="quick-add-btn px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">
                                                Player 1
                                            </button>
                                            <button class="quick-add-btn px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">
                                                Player 2
                                            </button>
                                            <button class="quick-add-btn px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">
                                                Player 3
                                            </button>
                                            <button class="quick-add-btn px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">
                                                Player 4
                                            </button>
                                        </div>
                                        
                                        <div class="text-xs text-gray-400">
                                            <span id="playerCount">0</span> / <span id="maxPlayerCount">8</span> players added
                                        </div>
                                    </div>
                                </div>

                                <!-- Tournament Controls -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-xl font-semibold text-white mb-4">Tournament Options</h2>
                                    <div class="space-y-4">
                                        <div class="flex items-center justify-between">
                                            <span class="text-gray-300">Auto-fill remaining slots</span>
                                            <label class="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" id="autoFillToggle" class="sr-only peer">
                                                <div class="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                            </label>
                                        </div>
                                        <div class="flex items-center justify-between">
                                            <span class="text-gray-300">Shuffle player order</span>
                                            <label class="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" id="shuffleToggle" class="sr-only peer" checked>
                                                <div class="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <!-- Action Buttons -->
                                <div class="flex space-x-4">
                                    <button 
                                        id="startTournamentButton"
                                        class="flex-1 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled
                                    >
                                        Start Tournament
                                    </button>
                                    <button 
                                        id="previewBracketButton"
                                        class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled
                                    >
                                        Preview Bracket
                                    </button>
                                </div>
                            </div>

                            <!-- Right Column: Players List -->
                            <div class="space-y-6">
                                <!-- Current Players -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-xl font-semibold text-white mb-4">Tournament Players</h2>
                                    <div id="playersContainer" class="space-y-2">
                                        <div class="text-center text-gray-400 py-8" id="emptyPlayersMessage">
                                            <svg class="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                            </svg>
                                            No players added yet
                                            <div class="text-sm mt-1">Add at least ${this.minPlayers} players to start</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Tournament Preview -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-xl font-semibold text-white mb-4">Tournament Preview</h2>
                                    <div id="tournamentPreview" class="text-center text-gray-400 py-8">
                                        <svg class="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                        </svg>
                                        Tournament structure will appear here
                                        <div class="text-sm mt-1">Add players to see the bracket preview</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Remote Tournament Setup -->
                        <div id="remoteTournamentSetup" class="hidden">
                            <div class="grid lg:grid-cols-2 gap-8">
                                <!-- Create New Tournament -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-xl font-semibold text-white mb-4">Create Remote Tournament</h2>
                                    <div class="space-y-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-300 mb-2">Tournament Name</label>
                                            <input 
                                                type="text" 
                                                id="remoteTournamentName"
                                                placeholder="Enter tournament name"
                                                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                value="Online Pong Tournament ${new Date().toLocaleDateString()}"
                                            >
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-300 mb-2">Description</label>
                                            <textarea 
                                                id="remoteTournamentDescription"
                                                placeholder="Tournament description (optional)"
                                                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                rows="3"
                                            ></textarea>
                                        </div>
                                        <div class="grid grid-cols-2 gap-4">
                                            <div>
                                                <label class="block text-sm font-medium text-gray-300 mb-2">Max Players</label>
                                                <select id="remoteMaxPlayersSelect" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                                    <option value="4">4</option>
                                                    <option value="8" selected>8</option>
                                                    <option value="16">16</option>
                                                    <option value="32">32</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label class="block text-sm font-medium text-gray-300 mb-2">Seeding Method</label>
                                                <select id="remoteSeedingSelect" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                                    <option value="random">Random</option>
                                                    <option value="ranking">By Ranking</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button 
                                            id="createRemoteTournamentButton"
                                            class="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-lg transition-all duration-200"
                                        >
                                            Create Remote Tournament
                                        </button>
                                    </div>
                                </div>

                                <!-- Join Existing Tournament -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-xl font-semibold text-white mb-4">Join Tournament</h2>
                                    <div class="space-y-4">
                                        <button 
                                            id="refreshTournamentsButton"
                                            class="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                        >
                                            Refresh Available Tournaments
                                        </button>
                                        <div id="availableTournaments" class="space-y-2 max-h-96 overflow-y-auto">
                                            <div class="text-center text-gray-400 py-8">
                                                <svg class="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                                </svg>
                                                Click refresh to load available tournaments
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        console.log('🏆 TournamentSetupPage: Initializing...');
        this.bindElements();
        this.attachEventListeners();
        this.updateUI();
        this.selectTournamentMode('local'); // Default to local mode
        console.log('✅ TournamentSetupPage: Initialization complete');
    }

    public cleanup(): void {
        this.removeEventListeners();
        this.players = [];
    }

    private bindElements(): void {
        // Elements are accessed by ID when needed
    }

    private attachEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', this.handleBackClick.bind(this));
        }

        // Tournament mode selector
        const tournamentModeCards = document.querySelectorAll('.tournament-mode-card');
        tournamentModeCards.forEach(card => {
            card.addEventListener('click', this.handleTournamentModeClick.bind(this));
        });

        const playerNameInput = document.getElementById('playerNameInput') as HTMLInputElement;
        if (playerNameInput) {
            playerNameInput.addEventListener('keydown', this.handlePlayerInputKeyDown.bind(this));
        }

        const addPlayerButton = document.getElementById('addPlayerButton');
        if (addPlayerButton) {
            addPlayerButton.addEventListener('click', this.handleAddPlayer.bind(this));
        }

        const quickAddButtons = document.querySelectorAll('.quick-add-btn');
        quickAddButtons.forEach(button => {
            button.addEventListener('click', this.handleQuickAddPlayer.bind(this));
        });

        const maxPlayersSelect = document.getElementById('maxPlayersSelect') as HTMLSelectElement;
        if (maxPlayersSelect) {
            maxPlayersSelect.addEventListener('change', this.handleMaxPlayersChange.bind(this));
        }

        const minPlayersSelect = document.getElementById('minPlayersSelect') as HTMLSelectElement;
        if (minPlayersSelect) {
            minPlayersSelect.addEventListener('change', this.handleMinPlayersChange.bind(this));
        }

        const startTournamentButton = document.getElementById('startTournamentButton');
        if (startTournamentButton) {
            startTournamentButton.addEventListener('click', this.handleStartTournament.bind(this));
        }

        const previewBracketButton = document.getElementById('previewBracketButton');
        if (previewBracketButton) {
            previewBracketButton.addEventListener('click', this.handlePreviewBracket.bind(this));
        }

        // Remote tournament event listeners
        const createRemoteTournamentButton = document.getElementById('createRemoteTournamentButton');
        if (createRemoteTournamentButton) {
            createRemoteTournamentButton.addEventListener('click', this.handleCreateRemoteTournament.bind(this));
        }

        const refreshTournamentsButton = document.getElementById('refreshTournamentsButton');
        if (refreshTournamentsButton) {
            refreshTournamentsButton.addEventListener('click', this.handleRefreshTournaments.bind(this));
        }
    }

    private removeEventListeners(): void {
        // Event listeners are automatically removed when the page is cleaned up
    }

    private handleBackClick(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: '/game' }
        });
        window.dispatchEvent(event);
    }

    private handlePlayerInputKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.handleAddPlayer();
        }
    }

    private handleAddPlayer(): void {
        const input = document.getElementById('playerNameInput') as HTMLInputElement;
        if (!input) return;

        const playerName = input.value.trim();
        if (this.addPlayer(playerName)) {
            input.value = '';
            input.focus();
        }
    }

    private handleQuickAddPlayer(event: Event): void {
        const button = event.currentTarget as HTMLButtonElement;
        const playerName = button.textContent?.trim();
        if (playerName) {
            this.addPlayer(playerName);
        }
    }

    private handleMaxPlayersChange(): void {
        const select = document.getElementById('maxPlayersSelect') as HTMLSelectElement;
        if (select) {
            this.maxPlayers = parseInt(select.value);
            this.updateUI();
        }
    }

    private handleMinPlayersChange(): void {
        const select = document.getElementById('minPlayersSelect') as HTMLSelectElement;
        if (select) {
            this.minPlayers = parseInt(select.value);
            this.updateUI();
        }
    }

    private handleStartTournament(): void {
        console.log('🚀 TournamentSetupPage: Starting tournament...');
        console.log(`   Current players: ${this.players.length}/${this.maxPlayers} (min: ${this.minPlayers})`);
        console.log(`   Player list: [${this.players.join(', ')}]`);
        
        if (this.players.length < this.minPlayers) {
            console.warn(`   ❌ Cannot start: need at least ${this.minPlayers} players`);
            showError(`Need at least ${this.minPlayers} players to start tournament`);
            return;
        }

        const tournamentName = (document.getElementById('tournamentName') as HTMLInputElement)?.value || 'Tournament';
        const autoFill = (document.getElementById('autoFillToggle') as HTMLInputElement)?.checked || false;
        const shuffle = (document.getElementById('shuffleToggle') as HTMLInputElement)?.checked || false;

        console.log(`   Tournament settings:`);
        console.log(`     Name: "${tournamentName}"`);
        console.log(`     Auto-fill: ${autoFill}`);
        console.log(`     Shuffle: ${shuffle}`);

        let finalPlayers = [...this.players];

        // Auto-fill if enabled
        if (autoFill && finalPlayers.length < this.maxPlayers) {
            const playersToAdd = this.maxPlayers - finalPlayers.length;
            console.log(`   🤖 Auto-filling ${playersToAdd} players...`);
            for (let i = 0; i < playersToAdd; i++) {
                finalPlayers.push(`Player ${finalPlayers.length + 1}`);
            }
            console.log(`   Final player list after auto-fill: [${finalPlayers.join(', ')}]`);
        }

        // Shuffle if enabled
        if (shuffle) {
            console.log('   🎲 Shuffling players...');
            const originalOrder = [...finalPlayers];
            for (let i = finalPlayers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [finalPlayers[i], finalPlayers[j]] = [finalPlayers[j], finalPlayers[i]];
            }
            console.log(`   Original order: [${originalOrder.join(', ')}]`);
            console.log(`   Shuffled order: [${finalPlayers.join(', ')}]`);
        }

        // Navigate to tournament bracket page
        const playersParam = encodeURIComponent(JSON.stringify(finalPlayers));
        const navigationPath = `/game/tournament/bracket?players=${playersParam}&name=${encodeURIComponent(tournamentName)}`;
        
        console.log(`   🎯 Navigating to tournament bracket:`);
        console.log(`     Path: ${navigationPath}`);
        console.log(`     Final players (${finalPlayers.length}): [${finalPlayers.join(', ')}]`);
        
        const event = new CustomEvent('navigate', {
            detail: { path: navigationPath }
        });
        window.dispatchEvent(event);
        console.log('   ✅ Navigation event dispatched');
    }

    private handlePreviewBracket(): void {
        this.updateTournamentPreview();
        showNotification('Bracket preview updated', 'info');
    }

    private addPlayer(playerName: string): boolean {
        console.log(`➕ TournamentSetupPage: Attempting to add player: "${playerName}"`);
        console.log(`   Current players (${this.players.length}/${this.maxPlayers}): [${this.players.join(', ')}]`);
        
        if (!playerName) {
            console.warn('   ❌ Cannot add player: empty name');
            showError('Please enter a player name');
            return false;
        }

        if (this.players.length >= this.maxPlayers) {
            console.warn(`   ❌ Cannot add player: max players reached (${this.maxPlayers})`);
            showError(`Maximum ${this.maxPlayers} players allowed`);
            return false;
        }

        if (this.players.includes(playerName)) {
            console.warn(`   ❌ Cannot add player: "${playerName}" already exists`);
            showError('Player name already exists');
            return false;
        }

        this.players.push(playerName);
        console.log(`   ✅ Player "${playerName}" added successfully`);
        console.log(`   New player list (${this.players.length}/${this.maxPlayers}): [${this.players.join(', ')}]`);
        
        this.updateUI();
        showNotification(`${playerName} added to tournament`, 'success');
        return true;
    }

    private removePlayer(playerName: string): void {
        console.log(`➖ TournamentSetupPage: Attempting to remove player: "${playerName}"`);
        console.log(`   Current players (${this.players.length}/${this.maxPlayers}): [${this.players.join(', ')}]`);
        
        const index = this.players.indexOf(playerName);
        if (index > -1) {
            this.players.splice(index, 1);
            console.log(`   ✅ Player "${playerName}" removed successfully`);
            console.log(`   New player list (${this.players.length}/${this.maxPlayers}): [${this.players.join(', ')}]`);
            
            this.updateUI();
            showNotification(`${playerName} removed from tournament`, 'info');
        } else {
            console.warn(`   ⚠️ Player "${playerName}" not found in list`);
        }
    }

    private updateUI(): void {
        this.updatePlayersList();
        this.updatePlayerCount();
        this.updateActionButtons();
        this.updateTournamentPreview();
    }

    private updatePlayersList(): void {
        const container = document.getElementById('playersContainer');
        const emptyMessage = document.getElementById('emptyPlayersMessage');
        
        if (!container || !emptyMessage) return;

        if (this.players.length === 0) {
            emptyMessage.style.display = 'block';
            return;
        }

        emptyMessage.style.display = 'none';
        
        container.innerHTML = this.players.map((player, index) => `
            <div class="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        ${index + 1}
                    </div>
                    <span class="text-white font-medium">${player}</span>
                </div>
                <button 
                    class="text-red-400 hover:text-red-300 transition-colors remove-player-btn"
                    data-player="${player}"
                    title="Remove player"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `).join('');

        // Add remove button listeners
        const removeButtons = container.querySelectorAll('.remove-player-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const playerName = (e.currentTarget as HTMLElement).getAttribute('data-player');
                if (playerName) {
                    this.removePlayer(playerName);
                }
            });
        });
    }

    private updatePlayerCount(): void {
        const playerCountElement = document.getElementById('playerCount');
        const maxPlayerCountElement = document.getElementById('maxPlayerCount');
        
        if (playerCountElement) {
            playerCountElement.textContent = this.players.length.toString();
        }
        
        if (maxPlayerCountElement) {
            maxPlayerCountElement.textContent = this.maxPlayers.toString();
        }
    }

    private updateActionButtons(): void {
        const startButton = document.getElementById('startTournamentButton') as HTMLButtonElement;
        const previewButton = document.getElementById('previewBracketButton') as HTMLButtonElement;
        
        const canStart = this.players.length >= this.minPlayers;
        
        if (startButton) {
            startButton.disabled = !canStart;
            startButton.textContent = canStart ? 'Start Tournament' : `Need ${this.minPlayers - this.players.length} more player${this.minPlayers - this.players.length !== 1 ? 's' : ''}`;
        }
        
        if (previewButton) {
            previewButton.disabled = !canStart;
        }
    }

    private updateTournamentPreview(): void {
        const preview = document.getElementById('tournamentPreview');
        if (!preview) return;

        if (this.players.length < this.minPlayers) {
            preview.innerHTML = `
                <svg class="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Tournament structure will appear here
                <div class="text-sm mt-1">Add ${this.minPlayers - this.players.length} more player${this.minPlayers - this.players.length !== 1 ? 's' : ''} to see preview</div>
            `;
            return;
        }

        const rounds = Math.ceil(Math.log2(this.players.length));
        const totalMatches = this.players.length - 1;

        preview.innerHTML = `
            <div class="text-left space-y-3">
                <div class="flex items-center justify-between py-2 border-b border-slate-600">
                    <span class="text-gray-300">Players:</span>
                    <span class="text-white font-semibold">${this.players.length}</span>
                </div>
                <div class="flex items-center justify-between py-2 border-b border-slate-600">
                    <span class="text-gray-300">Rounds:</span>
                    <span class="text-white font-semibold">${rounds}</span>
                </div>
                <div class="flex items-center justify-between py-2 border-b border-slate-600">
                    <span class="text-gray-300">Total Matches:</span>
                    <span class="text-white font-semibold">${totalMatches}</span>
                </div>
                <div class="flex items-center justify-between py-2">
                    <span class="text-gray-300">Format:</span>
                    <span class="text-white font-semibold">Single Elimination</span>
                </div>
            </div>
        `;
    }

    // ================================
    // TOURNAMENT MODE HANDLING
    // ================================

    private handleTournamentModeClick(event: Event): void {
        const card = event.currentTarget as HTMLElement;
        const mode = card.getAttribute('data-mode') as 'local' | 'remote';
        this.selectTournamentMode(mode);
    }

    private selectTournamentMode(mode: 'local' | 'remote'): void {
        console.log(`🎯 TournamentSetupPage: Selecting tournament mode: ${mode}`);
        console.log(`   Previous mode: ${this.isRemoteTournament ? 'remote' : 'local'}`);
        
        this.isRemoteTournament = mode === 'remote';
        
        // Update visual selection
        document.querySelectorAll('.tournament-mode-card').forEach(card => {
            card.classList.remove('border-blue-500', 'border-purple-500', 'bg-slate-700');
            card.classList.add('border-slate-600');
        });
        
        const selectedCard = document.querySelector(`.tournament-mode-card[data-mode="${mode}"]`);
        if (selectedCard) {
            selectedCard.classList.remove('border-slate-600');
            selectedCard.classList.add(mode === 'local' ? 'border-blue-500' : 'border-purple-500', 'bg-slate-700');
            console.log(`   ✅ Visual selection updated for ${mode} mode`);
        } else {
            console.warn(`   ⚠️ Could not find tournament mode card for: ${mode}`);
        }

        // Show/hide appropriate sections
        const localSetup = document.getElementById('localTournamentSetup');
        const remoteSetup = document.getElementById('remoteTournamentSetup');
        
        console.log(`   Local setup element: ${localSetup ? 'found' : 'missing'}`);
        console.log(`   Remote setup element: ${remoteSetup ? 'found' : 'missing'}`);
        
        if (mode === 'local') {
            localSetup?.classList.remove('hidden');
            remoteSetup?.classList.add('hidden');
            console.log('   📱 Showing local tournament setup');
        } else {
            localSetup?.classList.add('hidden');
            remoteSetup?.classList.remove('hidden');
            console.log('   🌐 Showing remote tournament setup, loading tournaments...');
            this.loadRemoteTournaments();
        }
    }

    // ================================
    // REMOTE TOURNAMENT METHODS
    // ================================

    private async handleCreateRemoteTournament(): Promise<void> {
        try {
            const nameInput = document.getElementById('remoteTournamentName') as HTMLInputElement;
            const descriptionInput = document.getElementById('remoteTournamentDescription') as HTMLTextAreaElement;
            const maxPlayersSelect = document.getElementById('remoteMaxPlayersSelect') as HTMLSelectElement;
            const seedingSelect = document.getElementById('remoteSeedingSelect') as HTMLSelectElement;

            const tournamentData = {
                name: nameInput.value.trim(),
                description: descriptionInput.value.trim(),
                max_players: parseInt(maxPlayersSelect.value),
                tournament_type: 'single_elimination',
                seeding_method: seedingSelect.value,
                auto_advance_timer: 300
            };

            if (!tournamentData.name) {
                showError('Tournament name is required');
                return;
            }

            const tournament = await remoteTournamentService.createTournament(tournamentData);
            showNotification('Tournament created successfully!', 'success');

            // Navigate to the remote tournament lobby
            const event = new CustomEvent('navigate', {
                detail: { path: `/game/tournament/remote/lobby/${tournament.id}` }
            });
            window.dispatchEvent(event);

        } catch (error) {
            console.error('Failed to create remote tournament:', error);
            showError(`Failed to create tournament: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleRefreshTournaments(): Promise<void> {
        await this.loadRemoteTournaments();
    }

    private async loadRemoteTournaments(): Promise<void> {
        try {
            const container = document.getElementById('availableTournaments');
            if (!container) return;

            container.innerHTML = `
                <div class="text-center text-gray-400 py-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
                    Loading tournaments...
                </div>
            `;

            this.remoteTournaments = await remoteTournamentService.getTournaments('registration', 20, 0);
            
            this.renderRemoteTournaments();
        } catch (error) {
            console.error('Failed to load remote tournaments:', error);
            const container = document.getElementById('availableTournaments');
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-gray-400 py-4">
                        <svg class="w-8 h-8 mx-auto mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Failed to load tournaments
                        <div class="text-sm mt-1">Check your connection and try again</div>
                    </div>
                `;
            }
        }
    }

    private renderRemoteTournaments(): void {
        const container = document.getElementById('availableTournaments');
        if (!container) return;

        if (this.remoteTournaments.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <svg class="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                    No tournaments available
                    <div class="text-sm mt-1">Create a new tournament to get started</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.remoteTournaments.map(tournament => `
            <div class="tournament-item p-4 bg-slate-700 rounded-lg border border-slate-600 hover:border-purple-500 transition-colors cursor-pointer" data-tournament-id="${tournament.id}">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h3 class="text-white font-semibold">${tournament.name}</h3>
                        ${tournament.description ? `<p class="text-sm text-gray-400 mt-1">${tournament.description}</p>` : ''}
                        <div class="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                            <span>${tournament.current_players}/${tournament.max_players} players</span>
                            <span>${tournament.tournament_type.replace('_', ' ')}</span>
                            <span>${tournament.seeding_method} seeding</span>
                        </div>
                    </div>
                    <div class="ml-4">
                        <button class="join-tournament-btn px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm" data-tournament-id="${tournament.id}">
                            Join
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners to join buttons
        container.querySelectorAll('.join-tournament-btn').forEach(button => {
            button.addEventListener('click', this.handleJoinTournament.bind(this));
        });
    }

    private async handleJoinTournament(event: Event): Promise<void> {
        event.stopPropagation();
        const button = event.currentTarget as HTMLElement;
        const tournamentId = parseInt(button.getAttribute('data-tournament-id') || '0');

        if (!tournamentId) return;

        try {
            const originalText = button.textContent;
            button.textContent = 'Joining...';
            
            await remoteTournamentService.joinTournament(tournamentId);
            
            // Navigate to tournament lobby
            const event = new CustomEvent('navigate', {
                detail: { path: `/game/tournament/remote/lobby/${tournamentId}` }
            });
            window.dispatchEvent(event);

        } catch (error) {
            console.error('Failed to join tournament:', error);
            showError(`Failed to join tournament: ${error instanceof Error ? error.message : 'Unknown error'}`);
            const button = event.currentTarget as HTMLElement;
            button.textContent = 'Join';
        }
    }
}