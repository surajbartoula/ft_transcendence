import { Page } from '../router/Router';
import remoteTournamentService, { Tournament, TournamentParticipant, TournamentAnnouncement } from '../services/remoteTournamentService';
import { showNotification, showError } from '../utils/ui';
import gameSocket from '../utils/gameSocket';

export class RemoteTournamentLobbyPage implements Page {
    public title = 'Tournament Lobby';
    public requiresAuth = true;

    private tournament: Tournament | null = null;
    private tournamentId: number = 0;
    private participants: TournamentParticipant[] = [];
    private announcements: TournamentAnnouncement[] = [];
    private isCreator: boolean = false;
    private refreshInterval: NodeJS.Timeout | null = null;

    public render(): string {
        return `
            <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900 flex flex-col">
                <!-- Header -->
                <div class="bg-slate-800 border-b border-slate-700 p-4">
                    <div class="flex items-center justify-between max-w-6xl mx-auto">
                        <div class="flex items-center space-x-4">
                            <button id="backButton" class="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                <span>Back to Setup</span>
                            </button>
                            <div class="h-6 w-px bg-slate-600"></div>
                            <h1 class="text-2xl font-bold text-white flex items-center">
                                <svg class="w-8 h-8 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
                                </svg>
                                <span id="tournamentTitle">Tournament Lobby</span>
                            </h1>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div id="tournamentStatus" class="px-3 py-1 bg-blue-600 text-white text-sm rounded">
                                Registration
                            </div>
                            <button id="startTournamentButton" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors hidden">
                                Start Tournament
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 p-6">
                    <div class="max-w-6xl mx-auto">
                        <div class="grid lg:grid-cols-3 gap-6">
                            <!-- Tournament Info -->
                            <div class="lg:col-span-2 space-y-6">
                                <!-- Tournament Details -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-xl font-semibold text-white">Tournament Details</h2>
                                        <button id="refreshButton" class="text-gray-300 hover:text-white transition-colors">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                            </svg>
                                        </button>
                                    </div>
                                    <div id="tournamentDetails" class="space-y-3">
                                        <div class="text-center text-gray-400 py-4">
                                            Loading tournament details...
                                        </div>
                                    </div>
                                </div>

                                <!-- Participants -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-xl font-semibold text-white">Participants</h2>
                                        <div class="text-sm text-gray-400" id="participantCount">
                                            0 / 0 players
                                        </div>
                                    </div>
                                    <div id="participantsList" class="space-y-2">
                                        <div class="text-center text-gray-400 py-4">
                                            Loading participants...
                                        </div>
                                    </div>
                                </div>

                                <!-- Tournament Bracket Preview (when tournament starts) -->
                                <div id="bracketPreview" class="bg-slate-800 rounded-lg border border-slate-700 p-6 hidden">
                                    <h2 class="text-xl font-semibold text-white mb-4">Tournament Bracket</h2>
                                    <div id="bracketContainer" class="min-h-64 bg-slate-900 rounded-lg p-4">
                                        <div class="text-center text-gray-400 py-8">
                                            Tournament bracket will appear here when started
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Sidebar -->
                            <div class="space-y-6">
                                <!-- Tournament Actions -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <h2 class="text-lg font-semibold text-white mb-4">Actions</h2>
                                    <div class="space-y-3">
                                        <button id="copyInviteButton" class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                                            Copy Invite Link
                                        </button>
                                        <button id="viewBracketButton" class="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors hidden">
                                            View Full Bracket
                                        </button>
                                        <button id="leaveTournamentButton" class="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                                            Leave Tournament
                                        </button>
                                    </div>
                                </div>

                                <!-- Tournament Settings (Creator Only) -->
                                <div id="creatorControls" class="bg-slate-800 rounded-lg border border-slate-700 p-6 hidden">
                                    <h2 class="text-lg font-semibold text-white mb-4">Tournament Settings</h2>
                                    <div class="space-y-3">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-300 mb-2">Seeding Method</label>
                                            <select id="seedingMethodSelect" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                                <option value="random">Random</option>
                                                <option value="ranking">By Ranking</option>
                                            </select>
                                        </div>
                                        <button id="applySeedingButton" class="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                                            Apply Seeding
                                        </button>
                                        <div class="pt-2 border-t border-slate-600">
                                            <button id="createAnnouncementButton" class="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors">
                                                Create Announcement
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Live Announcements -->
                                <div class="bg-slate-800 rounded-lg border border-slate-700 p-6">
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-lg font-semibold text-white">Announcements</h2>
                                        <span id="unreadCount" class="px-2 py-1 bg-red-600 text-white text-xs rounded-full hidden">0</span>
                                    </div>
                                    <div id="announcementsList" class="space-y-2 max-h-64 overflow-y-auto">
                                        <div class="text-center text-gray-400 py-4 text-sm">
                                            No announcements yet
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Create Announcement Modal -->
                <div id="announcementModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                    <div class="bg-slate-800 rounded-lg border border-slate-700 p-8 max-w-md w-full mx-4">
                        <h3 class="text-xl font-semibold text-white mb-6 text-center">Create Announcement</h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">Title</label>
                                <input 
                                    type="text" 
                                    id="announcementTitle"
                                    placeholder="Announcement title"
                                    class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    maxlength="100"
                                >
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">Message</label>
                                <textarea 
                                    id="announcementMessage"
                                    placeholder="Your message to participants..."
                                    class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    rows="4"
                                    maxlength="500"
                                ></textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                                <select id="announcementPriority" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                    <option value="1">Low</option>
                                    <option value="2" selected>Medium</option>
                                    <option value="3">High</option>
                                </select>
                            </div>
                        </div>
                        <div class="flex space-x-4 mt-8">
                            <button id="sendAnnouncementButton" class="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                                Send Announcement
                            </button>
                            <button id="cancelAnnouncementButton" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Notifications Container -->
                <div id="notifications" class="fixed top-20 right-4 z-40 pointer-events-none"></div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        this.parseTournamentId();
        this.bindElements();
        this.attachEventListeners();
        this.attachSocketEventListeners();
        await this.loadTournamentData();
        this.startRefreshInterval();
        
        // Join tournament room for real-time updates
        gameSocket.joinTournamentRoom(this.tournamentId);
    }

    public cleanup(): void {
        this.removeEventListeners();
        this.removeSocketEventListeners();
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        // Leave tournament room
        gameSocket.leaveTournamentRoom();
    }

    private parseTournamentId(): void {
        const pathParts = window.location.pathname.split('/');
        const idIndex = pathParts.indexOf('lobby') + 1;
        const parsedId = idIndex > 0 ? parseInt(pathParts[idIndex]) : NaN;
        
        if (isNaN(parsedId) || parsedId <= 0) {
            showError('Invalid tournament ID');
            this.navigateBack();
            return;
        }
        
        this.tournamentId = parsedId;
    }

    private bindElements(): void {
        // Elements accessed by ID when needed
    }

    private attachEventListeners(): void {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', this.navigateBack.bind(this));
        }

        const refreshButton = document.getElementById('refreshButton');
        if (refreshButton) {
            refreshButton.addEventListener('click', this.handleRefresh.bind(this));
        }

        const startTournamentButton = document.getElementById('startTournamentButton');
        if (startTournamentButton) {
            startTournamentButton.addEventListener('click', this.handleStartTournament.bind(this));
        }

        const copyInviteButton = document.getElementById('copyInviteButton');
        if (copyInviteButton) {
            copyInviteButton.addEventListener('click', this.handleCopyInvite.bind(this));
        }

        const viewBracketButton = document.getElementById('viewBracketButton');
        if (viewBracketButton) {
            viewBracketButton.addEventListener('click', this.handleViewBracket.bind(this));
        }

        const leaveTournamentButton = document.getElementById('leaveTournamentButton');
        if (leaveTournamentButton) {
            leaveTournamentButton.addEventListener('click', this.handleLeaveTournament.bind(this));
        }

        const applySeedingButton = document.getElementById('applySeedingButton');
        if (applySeedingButton) {
            applySeedingButton.addEventListener('click', this.handleApplySeeding.bind(this));
        }

        const createAnnouncementButton = document.getElementById('createAnnouncementButton');
        if (createAnnouncementButton) {
            createAnnouncementButton.addEventListener('click', this.showAnnouncementModal.bind(this));
        }

        const sendAnnouncementButton = document.getElementById('sendAnnouncementButton');
        if (sendAnnouncementButton) {
            sendAnnouncementButton.addEventListener('click', this.handleSendAnnouncement.bind(this));
        }

        const cancelAnnouncementButton = document.getElementById('cancelAnnouncementButton');
        if (cancelAnnouncementButton) {
            cancelAnnouncementButton.addEventListener('click', this.hideAnnouncementModal.bind(this));
        }
    }

    private removeEventListeners(): void {
        // Event listeners are automatically cleaned up
    }
    
    private boundHandlers = {
        tournamentUpdate: this.handleTournamentSocketUpdate.bind(this) as EventListener,
        tournamentStarted: this.handleTournamentSocketStarted.bind(this) as EventListener,
        tournamentAnnouncement: this.handleTournamentSocketAnnouncement.bind(this) as EventListener
    };

    private attachSocketEventListeners(): void {
        window.addEventListener('tournamentUpdate', this.boundHandlers.tournamentUpdate);
        window.addEventListener('tournamentStarted', this.boundHandlers.tournamentStarted);
        window.addEventListener('tournamentAnnouncement', this.boundHandlers.tournamentAnnouncement);
    }
    
    private removeSocketEventListeners(): void {
        window.removeEventListener('tournamentUpdate', this.boundHandlers.tournamentUpdate);
        window.removeEventListener('tournamentStarted', this.boundHandlers.tournamentStarted);
        window.removeEventListener('tournamentAnnouncement', this.boundHandlers.tournamentAnnouncement);
    }
    
    private handleTournamentSocketUpdate(event: Event): void {
        const customEvent = event as CustomEvent;
        const data = customEvent.detail;
        if (data.tournament_id === this.tournamentId) {
            console.log('Real-time tournament update received:', data);
            // Refresh tournament data
            this.loadTournamentData();
        }
    }
    
    private handleTournamentSocketStarted(event: Event): void {
        const customEvent = event as CustomEvent;
        const data = customEvent.detail;
        if (data.tournament_id === this.tournamentId) {
            console.log('Tournament started via socket:', data);
            // Navigate to bracket view
            setTimeout(() => {
                this.handleViewBracket();
            }, 1000);
        }
    }
    
    private handleTournamentSocketAnnouncement(event: Event): void {
        const customEvent = event as CustomEvent;
        const data = customEvent.detail;
        if (data.tournament_id === this.tournamentId) {
            console.log('New tournament announcement via socket:', data);
            // Refresh to show new announcement
            this.loadTournamentData();
        }
    }

    private async loadTournamentData(): Promise<void> {
        try {
            this.tournament = await remoteTournamentService.getTournament(this.tournamentId);
            
            if (!this.tournament) {
                showError('Tournament not found');
                this.navigateBack();
                return;
            }

            this.participants = this.tournament.participants || [];
            this.announcements = this.tournament.announcements || [];
            
            // Check if current user is the creator
            const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
            this.isCreator = currentUser.id === this.tournament.creator_id;

            this.updateUI();
        } catch (error) {
            console.error('Failed to load tournament data:', error);
            showError('Failed to load tournament data');
        }
    }

    private updateUI(): void {
        if (!this.tournament) return;

        this.updateTournamentDetails();
        this.updateParticipants();
        this.updateAnnouncements();
        this.updateCreatorControls();
        this.updateActionButtons();
    }

    private updateTournamentDetails(): void {
        if (!this.tournament) return;

        const titleElement = document.getElementById('tournamentTitle');
        const statusElement = document.getElementById('tournamentStatus');
        const detailsElement = document.getElementById('tournamentDetails');

        if (titleElement) {
            titleElement.textContent = this.tournament.name;
        }

        if (statusElement) {
            statusElement.textContent = this.tournament.status.charAt(0).toUpperCase() + this.tournament.status.slice(1);
            statusElement.className = `px-3 py-1 text-white text-sm rounded ${this.getStatusColor(this.tournament.status)}`;
        }

        if (detailsElement) {
            detailsElement.innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <span class="text-gray-300">Status:</span>
                            <span class="text-white font-semibold">${this.tournament.status}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Max Players:</span>
                            <span class="text-white font-semibold">${this.tournament.max_players}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Tournament Type:</span>
                            <span class="text-white font-semibold">${this.tournament.tournament_type.replace('_', ' ')}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Seeding:</span>
                            <span class="text-white font-semibold">${this.tournament.seeding_method}</span>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <span class="text-gray-300">Current Round:</span>
                            <span class="text-white font-semibold">${this.tournament.current_round}/${this.tournament.total_rounds || 'TBD'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-300">Created:</span>
                            <span class="text-white font-semibold">${new Date(this.tournament.created_at).toLocaleDateString()}</span>
                        </div>
                        ${this.tournament.started_at ? `
                            <div class="flex justify-between">
                                <span class="text-gray-300">Started:</span>
                                <span class="text-white font-semibold">${new Date(this.tournament.started_at).toLocaleTimeString()}</span>
                            </div>
                        ` : ''}
                        ${this.tournament.winner_id ? `
                            <div class="flex justify-between">
                                <span class="text-gray-300">Winner:</span>
                                <span class="text-green-400 font-semibold">${this.participants.find(p => p.user_id === this.tournament!.winner_id)?.username || 'Unknown'}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                ${this.tournament.description ? `
                    <div class="mt-4 pt-4 border-t border-slate-600">
                        <p class="text-gray-300">${this.tournament.description}</p>
                    </div>
                ` : ''}
            `;
        }
    }

    private updateParticipants(): void {
        const participantCountElement = document.getElementById('participantCount');
        const participantsListElement = document.getElementById('participantsList');

        if (participantCountElement && this.tournament) {
            participantCountElement.textContent = `${this.participants.length} / ${this.tournament.max_players} players`;
        }

        if (participantsListElement) {
            if (this.participants.length === 0) {
                participantsListElement.innerHTML = `
                    <div class="text-center text-gray-400 py-4">
                        No participants yet
                    </div>
                `;
            } else {
                participantsListElement.innerHTML = this.participants
                    .sort((a, b) => (a.seed_number || 999) - (b.seed_number || 999))
                    .map((participant, index) => `
                        <div class="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                            <div class="flex items-center space-x-3">
                                ${participant.seed_number ? `
                                    <div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                        ${participant.seed_number}
                                    </div>
                                ` : `
                                    <div class="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                        ${index + 1}
                                    </div>
                                `}
                                <div>
                                    <div class="text-white font-medium">${participant.username}</div>
                                    <div class="text-xs text-gray-400">
                                        ${participant.ranking_points} pts • ${participant.status}
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center space-x-2">
                                ${participant.status === 'winner' ? `
                                    <svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732L14.146 12.8l-1.179 4.456a1 1 0 01-1.934 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732L9.854 7.2l1.179-4.456A1 1 0 0112 2z" clip-rule="evenodd"></path>
                                    </svg>
                                ` : participant.status === 'eliminated' ? `
                                    <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                ` : ''}
                            </div>
                        </div>
                    `).join('');
            }
        }
    }

    private updateAnnouncements(): void {
        const announcementsListElement = document.getElementById('announcementsList');
        const unreadCountElement = document.getElementById('unreadCount');

        if (!announcementsListElement) return;

        if (this.announcements.length === 0) {
            announcementsListElement.innerHTML = `
                <div class="text-center text-gray-400 py-4 text-sm">
                    No announcements yet
                </div>
            `;
        } else {
            const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
            const unreadCount = this.announcements.filter(a => 
                !a.is_read_by.includes(currentUser.id)
            ).length;

            if (unreadCountElement) {
                if (unreadCount > 0) {
                    unreadCountElement.textContent = unreadCount.toString();
                    unreadCountElement.classList.remove('hidden');
                } else {
                    unreadCountElement.classList.add('hidden');
                }
            }

            announcementsListElement.innerHTML = this.announcements
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(announcement => `
                    <div class="p-3 bg-slate-700 rounded-lg border border-slate-600 ${!announcement.is_read_by.includes(currentUser.id) ? 'border-l-4 border-l-purple-500' : ''}" data-announcement-id="${announcement.id}">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-1">
                                    <h4 class="text-white font-medium text-sm">${announcement.title}</h4>
                                    ${this.getPriorityIcon(announcement.priority)}
                                </div>
                                <p class="text-gray-300 text-sm">${announcement.message}</p>
                                <div class="text-xs text-gray-500 mt-2">
                                    ${new Date(announcement.created_at).toLocaleString()}
                                </div>
                            </div>
                            ${!announcement.is_read_by.includes(currentUser.id) ? `
                                <button class="mark-read-btn text-purple-400 hover:text-purple-300 text-xs" data-announcement-id="${announcement.id}">
                                    Mark Read
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('');

            // Add event listeners for mark read buttons
            announcementsListElement.querySelectorAll('.mark-read-btn').forEach(button => {
                button.addEventListener('click', this.handleMarkAnnouncementRead.bind(this));
            });
        }
    }

    private updateCreatorControls(): void {
        const creatorControls = document.getElementById('creatorControls');
        const startTournamentButton = document.getElementById('startTournamentButton');
        const seedingSelect = document.getElementById('seedingMethodSelect') as HTMLSelectElement;

        if (creatorControls) {
            if (this.isCreator && this.tournament?.status === 'registration') {
                creatorControls.classList.remove('hidden');
                
                if (seedingSelect && this.tournament) {
                    seedingSelect.value = this.tournament.seeding_method;
                }
            } else {
                creatorControls.classList.add('hidden');
            }
        }

        if (startTournamentButton) {
            const canStart = this.isCreator && 
                           this.tournament?.status === 'registration' && 
                           this.participants.length >= 2;
            
            if (canStart) {
                startTournamentButton.classList.remove('hidden');
            } else {
                startTournamentButton.classList.add('hidden');
            }
        }
    }

    private updateActionButtons(): void {
        const viewBracketButton = document.getElementById('viewBracketButton');
        
        if (viewBracketButton && this.tournament) {
            if (this.tournament.status === 'active' || this.tournament.status === 'finished') {
                viewBracketButton.classList.remove('hidden');
            } else {
                viewBracketButton.classList.add('hidden');
            }
        }
    }

    private getStatusColor(status: string): string {
        switch (status) {
            case 'registration': return 'bg-blue-600';
            case 'active': return 'bg-green-600';
            case 'finished': return 'bg-gray-600';
            case 'cancelled': return 'bg-red-600';
            default: return 'bg-slate-600';
        }
    }

    private getPriorityIcon(priority: number): string {
        switch (priority) {
            case 3:
                return '<span class="text-red-400 text-xs">🔥 HIGH</span>';
            case 2:
                return '<span class="text-yellow-400 text-xs">⚡ MED</span>';
            default:
                return '<span class="text-gray-400 text-xs">ℹ️ LOW</span>';
        }
    }

    private startRefreshInterval(): void {
        if (!this.tournamentId || this.tournamentId <= 0) {
            console.warn('Cannot start refresh interval: Invalid tournament ID');
            return;
        }
        
        this.refreshInterval = setInterval(async () => {
            await this.loadTournamentData();
        }, 5000); // Refresh every 5 seconds
    }

    private async handleRefresh(): Promise<void> {
        await this.loadTournamentData();
        showNotification('Tournament data refreshed', 'info');
    }

    private async handleStartTournament(): Promise<void> {
        if (!this.isCreator || !this.tournament || this.tournament.status !== 'registration') {
            showError('Cannot start tournament');
            return;
        }

        if (this.participants.length < 2) {
            showError('Need at least 2 participants to start tournament');
            return;
        }

        try {
            const confirmed = confirm(`Start tournament with ${this.participants.length} players?`);
            if (!confirmed) return;

            await remoteTournamentService.startTournament(this.tournamentId);
            showNotification('Tournament started successfully!', 'success');
            
            // Navigate to bracket view
            setTimeout(() => {
                this.handleViewBracket();
            }, 1500);
        } catch (error) {
            console.error('Failed to start tournament:', error);
            showError(`Failed to start tournament: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleApplySeeding(): Promise<void> {
        if (!this.isCreator || !this.tournament) return;

        try {
            const seedingSelect = document.getElementById('seedingMethodSelect') as HTMLSelectElement;
            const seedingMethod = seedingSelect.value as 'random' | 'ranking';

            await remoteTournamentService.applySeeding(this.tournamentId, seedingMethod);
            await this.loadTournamentData(); // Refresh to show new seeding
        } catch (error) {
            console.error('Failed to apply seeding:', error);
        }
    }

    private handleCopyInvite(): void {
        const inviteUrl = `${window.location.origin}/game/tournament/setup?join=${this.tournamentId}`;
        navigator.clipboard.writeText(inviteUrl).then(() => {
            showNotification('Invite link copied to clipboard!', 'success');
        }).catch(() => {
            showError('Failed to copy invite link');
        });
    }

    private handleViewBracket(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: `/game/tournament/remote/bracket/${this.tournamentId}` }
        });
        window.dispatchEvent(event);
    }

    private handleLeaveTournament(): void {
        const confirmed = confirm('Are you sure you want to leave this tournament?');
        if (confirmed) {
            // For now, just navigate back - could implement leave functionality
            this.navigateBack();
        }
    }

    private showAnnouncementModal(): void {
        const modal = document.getElementById('announcementModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    private hideAnnouncementModal(): void {
        const modal = document.getElementById('announcementModal');
        const titleInput = document.getElementById('announcementTitle') as HTMLInputElement;
        const messageInput = document.getElementById('announcementMessage') as HTMLTextAreaElement;
        
        if (modal) {
            modal.classList.add('hidden');
        }
        
        if (titleInput) titleInput.value = '';
        if (messageInput) messageInput.value = '';
    }

    private async handleSendAnnouncement(): Promise<void> {
        const titleInput = document.getElementById('announcementTitle') as HTMLInputElement;
        const messageInput = document.getElementById('announcementMessage') as HTMLTextAreaElement;
        const prioritySelect = document.getElementById('announcementPriority') as HTMLSelectElement;

        const title = titleInput.value.trim();
        const message = messageInput.value.trim();
        const priority = parseInt(prioritySelect.value) as 1 | 2 | 3;

        if (!title || !message) {
            showError('Title and message are required');
            return;
        }

        try {
            await remoteTournamentService.createTournamentAnnouncement(this.tournamentId, {
                title,
                message,
                priority
            });

            this.hideAnnouncementModal();
            await this.loadTournamentData(); // Refresh to show new announcement
        } catch (error) {
            console.error('Failed to create announcement:', error);
        }
    }

    private async handleMarkAnnouncementRead(event: Event): Promise<void> {
        const button = event.currentTarget as HTMLElement;
        const announcementId = parseInt(button.getAttribute('data-announcement-id') || '0');

        if (!announcementId) return;

        try {
            await remoteTournamentService.markAnnouncementAsRead(announcementId);
            await this.loadTournamentData(); // Refresh to update read status
        } catch (error) {
            console.error('Failed to mark announcement as read:', error);
        }
    }

    private navigateBack(): void {
        const event = new CustomEvent('navigate', {
            detail: { path: '/game/tournament/setup' }
        });
        window.dispatchEvent(event);
    }
}