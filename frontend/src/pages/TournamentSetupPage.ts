import { Page } from '../router/Router';
import { showNotification, showError } from '../utils/ui';
import { TournamentManager } from '../babylonjs/TournamentManager';

export class TournamentSetupPage implements Page {
    public title = 'Tournament Setup';
    public requiresAuth = true;

    private players: string[] = [];
    private maxPlayers: number = 8;
    private tournamentManager!: TournamentManager;

    public render(): string {
        return `
            <div class="min-h-screen bg-black relative overflow-hidden flex flex-col">
                <!-- Tron-inspired animated background -->
                <div class="absolute inset-0 opacity-30">
                    <!-- Animated grid -->
                    <div class="absolute inset-0" style="background-image: 
                        linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px);
                        background-size: 40px 40px; 
                        animation: grid-move 20s linear infinite;">
                    </div>
                    
                    <!-- Glowing circuit lines -->
                    <div class="absolute inset-0">
                        <div class="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-cyan-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite;"></div>
                        <div class="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-blue-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite; animation-delay: 1.5s;"></div>
                        <div class="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-purple-500 to-transparent shadow-purple-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite; animation-delay: 0.5s;"></div>
                        <div class="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-pink-500 to-transparent shadow-pink-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite; animation-delay: 2s;"></div>
                    </div>
                    
                    <!-- Floating particles -->
                    <div class="absolute inset-0">
                        <div class="absolute w-1 h-1 bg-cyan-400 rounded-full animate-ping" style="top: 20%; left: 15%; animation-delay: 0s;"></div>
                        <div class="absolute w-1 h-1 bg-blue-400 rounded-full animate-ping" style="top: 60%; left: 80%; animation-delay: 1s;"></div>
                        <div class="absolute w-1 h-1 bg-purple-400 rounded-full animate-ping" style="top: 40%; left: 60%; animation-delay: 2s;"></div>
                        <div class="absolute w-1 h-1 bg-pink-400 rounded-full animate-ping" style="top: 80%; left: 30%; animation-delay: 1.5s;"></div>
                    </div>
                    
                    <!-- Hexagonal pattern overlay -->
                    <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle at 25px 25px, rgba(0, 255, 255, 0.2) 2px, transparent 2px); background-size: 50px 50px;"></div>
                </div>
                
                <style>
                    @keyframes grid-move {
                        0% { transform: translate(0, 0); }
                        100% { transform: translate(40px, 40px); }
                    }
                    
                    @keyframes line-glow {
                        0%, 100% { opacity: 0.3; box-shadow: 0 0 5px currentColor; }
                        50% { opacity: 1; box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
                    }
                    
                    .tron-glow {
                        box-shadow: 0 0 10px rgba(0, 255, 255, 0.3), 0 0 20px rgba(0, 255, 255, 0.1);
                    }
                    
                    .tron-border {
                        border: 1px solid rgba(0, 255, 255, 0.3);
                        position: relative;
                    }
                    
                    .tron-border::before {
                        content: '';
                        position: absolute;
                        top: -1px;
                        left: -1px;
                        right: -1px;
                        bottom: -1px;
                        background: linear-gradient(45deg, transparent, rgba(0, 255, 255, 0.1), transparent);
                        z-index: -1;
                        border-radius: inherit;
                    }
                </style>
                
                <!-- Header -->
                <div class="bg-slate-900/90 backdrop-blur-sm border-b border-cyan-500/30 p-4 relative z-10 tron-glow flex-shrink-0">
                    <div class="flex items-center justify-between max-w-4xl mx-auto">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors tron-glow">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Menu</span>
                            </button>
                            <div class="h-6 w-px bg-cyan-500/30"></div>
                            <h1 class="text-2xl font-bold text-cyan-400 flex items-center">
                                <svg class="w-8 h-8 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                                Tournament Setup
                            </h1>
                        </div>
                        <div class="text-sm text-cyan-300">
                            Create a tournament bracket
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 p-8 relative z-10 bg-slate-900/50 backdrop-blur-sm">
                    <div class="max-w-6xl mx-auto">
                        <!-- Tournament Mode Selector -->
                        <div class="mb-8 bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                            <h2 class="text-xl font-semibold text-cyan-300 mb-4">Tournament Type</h2>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="tournament-mode-card cursor-pointer p-4 border border-cyan-500/30 rounded-lg hover:border-cyan-400 transition-all duration-300 tron-border hover:tron-glow" data-mode="local">
                                    <div class="flex items-center space-x-3">
                                        <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center tron-glow">
                                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 class="text-lg font-semibold text-cyan-300">Local Tournament</h3>
                                            <p class="text-sm text-gray-400">Play with friends locally</p>
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
                                <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <h2 class="text-xl font-semibold text-cyan-300 mb-4">Tournament Information</h2>
                                    <div class="space-y-4">
                                        <div>
                                            <label class="block text-sm font-medium text-cyan-400 mb-2">Tournament Name</label>
                                            <input 
                                                type="text" 
                                                id="tournamentName"
                                                placeholder="Enter tournament name"
                                                class="w-full px-3 py-2 bg-slate-900/50 border border-cyan-500/30 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all tron-glow"
                                                value="Pong Tournament ${new Date().toLocaleDateString()}"
                                            >
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-cyan-400 mb-2">Maximum Players</label>
                                            <select id="maxPlayersSelect" class="w-full px-3 py-2 bg-slate-900/50 border border-cyan-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all tron-glow">
                                                <option value="4">4</option>
                                                <option value="8" selected>8</option>
                                                <option value="16">16</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- Add Players -->
                                <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <h2 class="text-xl font-semibold text-cyan-300 mb-4">Add Players</h2>
                                    <div class="space-y-4">
                                        <div class="flex space-x-2">
                                            <input 
                                                type="text" 
                                                id="playerNameInput"
                                                placeholder="Enter player name"
                                                class="flex-1 px-3 py-2 bg-slate-900/50 border border-cyan-500/30 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 transition-all tron-glow"
                                                maxlength="20"
                                            >
                                            <button 
                                                id="addPlayerButton"
                                                class="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white rounded-md transition-all duration-300 flex items-center tron-glow"
                                            >
                                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                                </svg>
                                                Add
                                            </button>
                                        </div>
                                        
                                        <!-- Quick Add Buttons -->
                                        <div class="flex flex-wrap gap-2">
                                            <button class="quick-add-btn px-3 py-1 bg-slate-700/70 border border-cyan-500/30 hover:bg-slate-600/70 hover:border-cyan-400 text-white text-sm rounded transition-all duration-300 tron-border">
                                                Player 1
                                            </button>
                                            <button class="quick-add-btn px-3 py-1 bg-slate-700/70 border border-cyan-500/30 hover:bg-slate-600/70 hover:border-cyan-400 text-white text-sm rounded transition-all duration-300 tron-border">
                                                Player 2
                                            </button>
                                            <button class="quick-add-btn px-3 py-1 bg-slate-700/70 border border-cyan-500/30 hover:bg-slate-600/70 hover:border-cyan-400 text-white text-sm rounded transition-all duration-300 tron-border">
                                                Player 3
                                            </button>
                                            <button class="quick-add-btn px-3 py-1 bg-slate-700/70 border border-cyan-500/30 hover:bg-slate-600/70 hover:border-cyan-400 text-white text-sm rounded transition-all duration-300 tron-border">
                                                Player 4
                                            </button>
                                        </div>
                                        
                                        <div class="text-xs text-gray-400">
                                            <span id="playerCount">0</span> / <span id="maxPlayerCount">8</span> players added
                                            <div class="text-xs text-cyan-400 mt-1">Valid tournament sizes: 2, 4, 8, or 16 players</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Tournament Controls -->
                                <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <h2 class="text-xl font-semibold text-cyan-300 mb-4">Tournament Options</h2>
                                    <div class="space-y-4">
                                        <div class="flex items-center justify-between">
                                            <span class="text-cyan-300">Shuffle player order</span>
                                            <label class="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" id="shuffleToggle" class="sr-only peer" checked>
                                                <div class="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-purple-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <!-- Action Buttons -->
                                <div class="flex space-x-4">
                                    <button
                                        id="startTournamentButton"
                                        class="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed tron-glow"
                                        disabled
                                    >
                                        Start Tournament
                                    </button>
                                </div>
                            </div>

                            <!-- Right Column: Players List -->
                            <div class="space-y-6">
                                <!-- Current Players -->
                                <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <h2 class="text-xl font-semibold text-cyan-300 mb-4">Tournament Players</h2>
                                    <div id="playersContainer" class="space-y-2">
                                        <div class="text-center text-cyan-400 py-8" id="emptyPlayersMessage">
                                            <svg class="w-12 h-12 mx-auto mb-2 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                            </svg>
                                            No players added yet
                                            <div class="text-sm mt-1">Add exactly 2, 4, 8, or 16 players to start</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Tournament Preview -->
                                <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 tron-border tron-glow">
                                    <h2 class="text-xl font-semibold text-cyan-300 mb-4">Tournament Preview</h2>
                                    <div id="tournamentPreview" class="text-center text-cyan-400 py-8">
                                        <svg class="w-12 h-12 mx-auto mb-2 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                        </svg>
                                        Tournament structure will appear here
                                        <div class="text-sm mt-1">Add players to see the bracket preview</div>
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
        // Initialize tournament manager and clear any existing data
        this.tournamentManager = TournamentManager.getInstance();
        this.tournamentManager.clearAllTournaments();
        this.bindElements();
        this.attachEventListeners();
        this.updateUI();
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


        const startTournamentButton = document.getElementById('startTournamentButton');
        if (startTournamentButton) {
            startTournamentButton.addEventListener('click', this.handleStartTournament.bind(this));
        }


    }

    private removeEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.removeEventListener('click', this.handleBackClick.bind(this));
        }

        const playerNameInput = document.getElementById('playerNameInput') as HTMLInputElement;
        if (playerNameInput) {
            playerNameInput.removeEventListener('keydown', this.handlePlayerInputKeyDown.bind(this));
        }

        const addPlayerButton = document.getElementById('addPlayerButton');
        if (addPlayerButton) {
            addPlayerButton.removeEventListener('click', this.handleAddPlayer.bind(this));
        }

        const quickAddButtons = document.querySelectorAll('.quick-add-btn');
        quickAddButtons.forEach(button => {
            button.removeEventListener('click', this.handleQuickAddPlayer.bind(this));
        });

        const maxPlayersSelect = document.getElementById('maxPlayersSelect') as HTMLSelectElement;
        if (maxPlayersSelect) {
            maxPlayersSelect.removeEventListener('change', this.handleMaxPlayersChange.bind(this));
        }


        const startTournamentButton = document.getElementById('startTournamentButton');
        if (startTournamentButton) {
            startTournamentButton.removeEventListener('click', this.handleStartTournament.bind(this));
        }


        // Remove dynamically added remove-player button listeners
        const removeButtons = document.querySelectorAll('.remove-player-btn');
        removeButtons.forEach(button => {
            button.removeEventListener('click', (e) => {
                const playerName = (e.currentTarget as HTMLElement).getAttribute('data-player');
                if (playerName) {
                    this.removePlayer(playerName);
                }
            });
        });
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


    private handleStartTournament(): void {
        const validPlayerCounts = [2, 4, 8, 16];
        if (!validPlayerCounts.includes(this.players.length)) {
            console.warn(`Cannot start: need exactly 2, 4, 8, or 16 players`);
            showError(`Tournament requires exactly 2, 4, 8, or 16 players. You currently have ${this.players.length} players.`);
            return;
        }

        const tournamentName = (document.getElementById('tournamentName') as HTMLInputElement)?.value || 'Tournament';
        const shuffle = (document.getElementById('shuffleToggle') as HTMLInputElement)?.checked || false;
        let finalPlayers = [...this.players];

        // Shuffle if enabled
        if (shuffle) {
            for (let i = finalPlayers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [finalPlayers[i], finalPlayers[j]] = [finalPlayers[j], finalPlayers[i]];
            }
        }

        // Navigate to tournament bracket page
        const playersParam = encodeURIComponent(JSON.stringify(finalPlayers));
        const navigationPath = `/game/tournament/bracket?players=${playersParam}&name=${encodeURIComponent(tournamentName)}`;
        const event = new CustomEvent('navigate', {
            detail: { path: navigationPath }
        });
        window.dispatchEvent(event);
    }


    private addPlayer(playerName: string): boolean {
        if (!playerName) {
            console.warn('Cannot add player: empty name');
            showError('Please enter a player name');
            return false;
        }

        if (this.players.length >= this.maxPlayers) {
            console.warn(`Cannot add player: max players reached (${this.maxPlayers})`);
            showError(`Maximum ${this.maxPlayers} players allowed`);
            return false;
        }

        if (this.players.includes(playerName)) {
            console.warn(`Cannot add player: "${playerName}" already exists`);
            showError('Player name already exists');
            return false;
        }

        this.players.push(playerName);
        this.updateUI();
        // showNotification(`${playerName} added to tournament`, 'success');
        return true;
    }

    private removePlayer(playerName: string): void {
        const index = this.players.indexOf(playerName);
        if (index > -1) {
            this.players.splice(index, 1);
            this.updateUI();
            showNotification(`${playerName} removed from tournament`, 'info');
        } else {
            console.warn(`Player "${playerName}" not found in list`);
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
        
        if (!container) {
            console.error('PlayersContainer not found');
            return;
        }
        if (this.players.length === 0) {
            // Show empty message
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8" id="emptyPlayersMessage">
                    <svg class="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    No players added yet
                    <div class="text-sm mt-1">Add exactly 2, 4, 8, or 16 players to start</div>
                </div>
            `;
            return;
        }

        // Show players list
        const playersHTML = this.players.map((player, index) => `
            <div class="flex items-center justify-between p-3 bg-slate-700 rounded-lg mb-2">
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

        container.innerHTML = playersHTML;
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

        const validPlayerCounts = [2, 4, 8, 16];
        const canStart = validPlayerCounts.includes(this.players.length);

        if (startButton) {
            startButton.disabled = !canStart;
            if (canStart) {
                startButton.textContent = 'Start Tournament';
            } else {
                const nextValidCount = validPlayerCounts.find(count => count > this.players.length) || 16;
                const playersNeeded = nextValidCount - this.players.length;
                startButton.textContent = `Need ${playersNeeded} more player${playersNeeded !== 1 ? 's' : ''} (${this.players.length}/${nextValidCount})`;
            }
        }
    }

    private updateTournamentPreview(): void {
        const preview = document.getElementById('tournamentPreview');
        if (!preview) return;

        const validPlayerCounts = [2, 4, 8, 16];
        if (!validPlayerCounts.includes(this.players.length)) {
            const nextValidCount = validPlayerCounts.find(count => count > this.players.length) || 16;
            const playersNeeded = nextValidCount - this.players.length;
            preview.innerHTML = `
                <svg class="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Tournament structure will appear here
                <div class="text-sm mt-1">Need ${playersNeeded} more player${playersNeeded !== 1 ? 's' : ''} for ${nextValidCount}-player tournament</div>
                <div class="text-xs mt-1 text-cyan-400">Valid sizes: 2, 4, 8, or 16 players</div>
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

}