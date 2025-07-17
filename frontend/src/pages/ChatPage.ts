// pages/ChatPage.ts - Chat page with all related functionality
import { Page } from '../router/Router';
import { User } from '../utils/auth';
import { showNotification, showError } from '../utils/ui';
import { API_CONFIG } from '../config';

interface ChatMessage {
    id: string;
    senderId: string;
    recipientId: string;
    content: string;
    timestamp: Date;
    isRead: boolean;
}

interface ChatUser {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    isOnline: boolean;
    lastSeen?: Date;
}

export class ChatPage implements Page {
    public title = 'Chat';
    public requiresAuth = true;
    
    private currentUser: User | null = null;
    private selectedChatUser: ChatUser | null = null;
    private chatUsers: ChatUser[] = [];
    private messages: ChatMessage[] = [];
    private websocket: WebSocket | null = null;
    
    // DOM elements
    private searchInput: HTMLInputElement | null = null;
    private messageInput: HTMLInputElement | null = null;
    private sendButton: HTMLButtonElement | null = null;
    private messagesContainer: HTMLElement | null = null;
    private chatsList: HTMLElement | null = null;
    private onlineList: HTMLElement | null = null;
    private invitesList: HTMLElement | null = null;
    
    // State
    private activeTab: 'chats' | 'online' | 'invites' = 'chats';
    private isTyping: boolean = false;
    private typingTimeout: number | null = null;

    public render(): string {
        return `
            <div class="min-h-screen flex bg-slate-900">
                <!-- Sidebar -->
                <div class="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
                    <!-- Header -->
                    <div class="p-4 border-b border-gray-700">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center space-x-3">
                                <div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                                    <span id="userInitial" class="font-bold text-white"></span>
                                </div>
                                <div>
                                    <h2 id="currentUsername" class="font-semibold text-white"></h2>
                                    <span id="connectionStatus" class="text-xs text-green-400">Connected</span>
                                </div>
                            </div>
                            <button data-route="/dashboard" class="text-gray-400 hover:text-white transition-colors">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                            </button>
                        </div>
                        <!-- Search Bar -->
                        <div class="relative">
                            <input type="text" id="searchInput" placeholder="Search users..."
                                class="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400">
                            <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                    </div>

                    <!-- Tabs -->
                    <div class="flex border-b border-gray-700">
                        <button id="chatsTab" class="flex-1 py-3 px-4 text-center text-purple-400 border-b-2 border-purple-400 font-medium">
                            Chats
                        </button>
                        <button id="onlineTab" class="flex-1 py-3 px-4 text-center text-gray-400 hover:text-white font-medium">
                            Online
                        </button>
                        <button id="invitesTab" class="flex-1 py-3 px-4 text-center text-gray-400 hover:text-white font-medium relative">
                            Invites
                            <span id="invitesBadge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">0</span>
                        </button>
                    </div>

                    <!-- Content Area -->
                    <div class="flex-1 overflow-y-auto">
                        <!-- Recent Chats -->
                        <div id="chatsList" class="p-2">
                            <div class="text-center py-8">
                                <div class="text-4xl mb-4">💬</div>
                                <p class="text-gray-400">No conversations yet</p>
                                <p class="text-sm text-gray-500 mt-2">Start a conversation to see it here</p>
                            </div>
                        </div>

                        <!-- Online Users -->
                        <div id="onlineList" class="hidden p-2">
                            <div class="text-center py-8">
                                <div class="text-4xl mb-4">👥</div>
                                <p class="text-gray-400">Loading online users...</p>
                            </div>
                        </div>

                        <!-- Game Invites -->
                        <div id="invitesList" class="hidden p-2">
                            <div class="text-center py-8">
                                <div class="text-4xl mb-4">🎮</div>
                                <p class="text-gray-400">No game invites</p>
                                <p class="text-sm text-gray-500 mt-2">Game invitations will appear here</p>
                            </div>
                        </div>

                        <!-- Search Results -->
                        <div id="searchResults" class="hidden p-2">
                            <!-- Search results will be populated here -->
                        </div>
                    </div>
                </div>

                <!-- Main Chat Area -->
                <div class="flex-1 flex flex-col">
                    <!-- Chat Header -->
                    <div id="chatHeader" class="hidden p-4 border-b border-gray-700 bg-gray-800">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <div id="chatUserAvatar" class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                    <span class="font-bold text-white"></span>
                                </div>
                                <div>
                                    <h3 id="chatUsername" class="font-semibold text-white"></h3>
                                    <p id="chatUserStatus" class="text-sm text-gray-400"></p>
                                </div>
                            </div>
                            <div class="flex items-center space-x-2">
                                <button id="gameInviteBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                                    🎮 Invite to Game
                                </button>
                                <button id="blockUserBtn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                                    Block
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Welcome Screen -->
                    <div id="welcomeScreen" class="flex-1 flex items-center justify-center bg-gray-900">
                        <div class="text-center">
                            <div class="w-24 h-24 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                                </svg>
                            </div>
                            <h2 class="text-2xl font-bold text-white mb-2">Welcome to Chat</h2>
                            <p class="text-gray-400">Select a conversation to start messaging</p>
                        </div>
                    </div>

                    <!-- Messages Area -->
                    <div id="messagesArea" class="hidden flex-1 flex flex-col">
                        <div id="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
                            <!-- Messages will be populated here -->
                        </div>

                        <!-- Typing Indicator -->
                        <div id="typingIndicator" class="hidden px-4 py-2">
                            <div class="flex items-center space-x-2 text-gray-400">
                                <span class="text-sm">Someone is typing</span>
                                <div class="flex space-x-1">
                                    <div class="typing-indicator"></div>
                                    <div class="typing-indicator"></div>
                                    <div class="typing-indicator"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Message Input -->
                        <div class="p-4 border-t border-gray-700">
                            <div class="flex items-center space-x-2">
                                <input type="text" id="messageInput" placeholder="Type a message..."
                                    class="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400">
                                <button id="sendBtn" class="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public async initialize(): Promise<void> {
        this.bindElements();
        this.loadUserData();
        this.attachEventListeners();
        this.populateUserInfo();
        await this.loadChatData();
        this.initializeWebSocket();
    }

    public cleanup(): void {
        // Close WebSocket connection
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        // Clear typing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Remove event listeners
        this.removeEventListeners();
    }

    private bindElements(): void {
        this.searchInput = document.getElementById('searchInput') as HTMLInputElement;
        this.messageInput = document.getElementById('messageInput') as HTMLInputElement;
        this.sendButton = document.getElementById('sendBtn') as HTMLButtonElement;
        this.messagesContainer = document.getElementById('messagesContainer') as HTMLElement;
        this.chatsList = document.getElementById('chatsList') as HTMLElement;
        this.onlineList = document.getElementById('onlineList') as HTMLElement;
        this.invitesList = document.getElementById('invitesList') as HTMLElement;
    }

    private loadUserData(): void {
        const userDataStr = localStorage.getItem('userData');
        if (userDataStr) {
            this.currentUser = JSON.parse(userDataStr);
        }
    }

    private attachEventListeners(): void {
        // Tab switching
        const chatsTab = document.getElementById('chatsTab');
        const onlineTab = document.getElementById('onlineTab');
        const invitesTab = document.getElementById('invitesTab');

        chatsTab?.addEventListener('click', () => this.switchTab('chats'));
        onlineTab?.addEventListener('click', () => this.switchTab('online'));
        invitesTab?.addEventListener('click', () => this.switchTab('invites'));

        // Search functionality
        if (this.searchInput) {
            this.searchInput.addEventListener('input', this.debounce((event: Event) => {
				const target = event.target as HTMLInputElement;
				this.handleSearch(target.value);
			}, 300));
        }

        // Message sending
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', this.handleMessageKeyPress.bind(this));
            this.messageInput.addEventListener('input', this.handleTyping.bind(this));
        }

        if (this.sendButton) {
            this.sendButton.addEventListener('click', this.sendMessage.bind(this));
        }

        // Game invite and block buttons
        const gameInviteBtn = document.getElementById('gameInviteBtn');
        const blockUserBtn = document.getElementById('blockUserBtn');

        gameInviteBtn?.addEventListener('click', this.sendGameInvite.bind(this));
        blockUserBtn?.addEventListener('click', this.blockUser.bind(this));
    }

    private removeEventListeners(): void {
        // Implementation for cleanup
    }

    private populateUserInfo(): void {
        if (!this.currentUser) return;

        const userInitial = document.getElementById('userInitial');
        const currentUsername = document.getElementById('currentUsername');

        if (userInitial) {
            userInitial.textContent = this.currentUser.name[0].toUpperCase();
        }

        if (currentUsername) {
            currentUsername.textContent = this.currentUser.name;
        }
    }

    private async loadChatData(): Promise<void> {
        try {
            await Promise.all([
                this.loadChatUsers(),
                this.loadOnlineUsers(),
                this.loadGameInvites()
            ]);
        } catch (error) {
            console.error('Failed to load chat data:', error);
            showError('Failed to load chat data');
        }
    }

    private async loadChatUsers(): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.CHAT}/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const conversations = await response.json();
                this.renderChatUsers(conversations);
            }
        } catch (error) {
            console.error('Failed to load chat users:', error);
        }
    }

    private async loadOnlineUsers(): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/online`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const users = await response.json();
                this.renderOnlineUsers(users);
            }
        } catch (error) {
            console.error('Failed to load online users:', error);
        }
    }

    private async loadGameInvites(): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.GAME}/invites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const invites = await response.json();
                this.renderGameInvites(invites);
            }
        } catch (error) {
            console.error('Failed to load game invites:', error);
        }
    }

    private initializeWebSocket(): void {
        const token = localStorage.getItem('token');
        if (!token) return;

        const wsUrl = `ws://localhost:3005/ws?token=${token}`;
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus('Connected');
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.websocket.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus('Disconnected');
            // Attempt to reconnect after 3 seconds
            setTimeout(() => this.initializeWebSocket(), 3000);
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('Error');
        };
    }

    private handleWebSocketMessage(data: any): void {
        switch (data.type) {
            case 'message':
                this.handleIncomingMessage(data.message);
                break;
            case 'typing':
                this.handleTypingIndicator(data);
                break;
            case 'user_online':
                this.handleUserOnline(data.user);
                break;
            case 'user_offline':
                this.handleUserOffline(data.user);
                break;
            case 'game_invite':
                this.handleGameInvite(data.invite);
                break;
        }
    }

    private switchTab(tab: 'chats' | 'online' | 'invites'): void {
        this.activeTab = tab;

        // Update tab styles
        const tabs = ['chatsTab', 'onlineTab', 'invitesTab'];
        const lists = ['chatsList', 'onlineList', 'invitesList'];

        tabs.forEach((tabId, index) => {
            const tabElement = document.getElementById(tabId);
            const listElement = document.getElementById(lists[index]);

            if (tabElement) {
                if (index === ['chats', 'online', 'invites'].indexOf(tab)) {
                    tabElement.className = 'flex-1 py-3 px-4 text-center text-purple-400 border-b-2 border-purple-400 font-medium';
                    listElement?.classList.remove('hidden');
                } else {
                    tabElement.className = 'flex-1 py-3 px-4 text-center text-gray-400 hover:text-white font-medium';
                    listElement?.classList.add('hidden');
                }
            }
        });
    }

    private async handleSearch(query: string): Promise<void> {
        if (!query.trim()) {
            document.getElementById('searchResults')?.classList.add('hidden');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const users = await response.json();
                this.renderSearchResults(users);
            }
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    private handleMessageKeyPress(e: KeyboardEvent): void {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    private handleTyping(): void {
        if (!this.selectedChatUser || !this.websocket) return;

        if (!this.isTyping) {
            this.isTyping = true;
            this.websocket.send(JSON.stringify({
                type: 'typing_start',
                recipientId: this.selectedChatUser.id
            }));
        }

        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Set new timeout
        this.typingTimeout = window.setTimeout(() => {
            this.isTyping = false;
            if (this.websocket) {
                this.websocket.send(JSON.stringify({
                    type: 'typing_stop',
                    recipientId: this.selectedChatUser?.id
                }));
            }
        }, 1000);
    }

    private async sendMessage(): Promise<void> {
        if (!this.messageInput || !this.selectedChatUser) return;

        const content = this.messageInput.value.trim();
        if (!content) return;

        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.CHAT}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipientId: this.selectedChatUser.id,
                    content
                })
            });

            if (response.ok) {
                const message = await response.json();
                this.addMessageToChat(message);
                this.messageInput.value = '';
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            showError('Failed to send message');
        }
    }

    private async sendGameInvite(): Promise<void> {
        if (!this.selectedChatUser) return;

        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.GAME}/invite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipientId: this.selectedChatUser.id,
                    gameType: 'ping-pong'
                })
            });

            if (response.ok) {
                showNotification('Game invite sent!', 'success');
            }
        } catch (error) {
            console.error('Failed to send game invite:', error);
            showError('Failed to send game invite');
        }
    }

    private async blockUser(): Promise<void> {
        if (!this.selectedChatUser) return;

        const confirmed = confirm(`Are you sure you want to block ${this.selectedChatUser.name}?`);
        if (!confirmed) return;

        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/block`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.selectedChatUser.id
                })
            });

            if (response.ok) {
                showNotification('User blocked successfully', 'success');
                this.selectedChatUser = null;
                this.showWelcomeScreen();
            }
        } catch (error) {
            console.error('Failed to block user:', error);
            showError('Failed to block user');
        }
    }

    private renderChatUsers(conversations: any[]): void {
        if (!this.chatsList) return;

        if (conversations.length === 0) {
            this.chatsList.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">💬</div>
                    <p class="text-gray-400">No conversations yet</p>
                    <p class="text-sm text-gray-500 mt-2">Start a conversation to see it here</p>
                </div>
            `;
            return;
        }

        this.chatsList.innerHTML = conversations.map(conv => `
            <div class="p-3 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors chat-user" data-user-id="${conv.user.id}">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span class="font-bold text-white">${conv.user.name[0].toUpperCase()}</span>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center">
                            <h3 class="font-medium text-white">${conv.user.name}</h3>
                            <span class="text-xs text-gray-400">${this.formatTime(conv.lastMessage.timestamp)}</span>
                        </div>
                        <p class="text-sm text-gray-400 truncate">${conv.lastMessage.content}</p>
                    </div>
                    ${conv.unreadCount > 0 ? `<span class="bg-purple-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">${conv.unreadCount}</span>` : ''}
                </div>
            </div>
        `).join('');

        // Add click listeners
        this.chatsList.querySelectorAll('.chat-user').forEach(element => {
            element.addEventListener('click', (e) => {
                const userId = (e.currentTarget as HTMLElement).dataset.userId;
                const user = conversations.find(c => c.user.id === userId)?.user;
                if (user) {
                    this.selectChatUser(user);
                }
            });
        });
    }

    private renderOnlineUsers(users: ChatUser[]): void {
        if (!this.onlineList) return;

        if (users.length === 0) {
            this.onlineList.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">👥</div>
                    <p class="text-gray-400">No users online</p>
                </div>
            `;
            return;
        }

        this.onlineList.innerHTML = users.map(user => `
            <div class="p-3 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors online-user" data-user-id="${user.id}">
                <div class="flex items-center space-x-3">
                    <div class="relative">
                        <div class="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                            <span class="font-bold text-white">${user.name[0].toUpperCase()}</span>
                        </div>
                        <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                    </div>
                    <div>
                        <h3 class="font-medium text-white">${user.name}</h3>
                        <p class="text-sm text-green-400">Online</p>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click listeners
        this.onlineList.querySelectorAll('.online-user').forEach(element => {
            element.addEventListener('click', (e) => {
                const userId = (e.currentTarget as HTMLElement).dataset.userId;
                const user = users.find(u => u.id === userId);
                if (user) {
                    this.selectChatUser(user);
                }
            });
        });
    }

    private renderGameInvites(invites: any[]): void {
        if (!this.invitesList) return;

        const invitesBadge = document.getElementById('invitesBadge');
        if (invitesBadge) {
            if (invites.length > 0) {
                invitesBadge.textContent = invites.length.toString();
                invitesBadge.classList.remove('hidden');
            } else {
                invitesBadge.classList.add('hidden');
            }
        }

        if (invites.length === 0) {
            this.invitesList.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">🎮</div>
                    <p class="text-gray-400">No game invites</p>
                    <p class="text-sm text-gray-500 mt-2">Game invitations will appear here</p>
                </div>
            `;
            return;
        }

        this.invitesList.innerHTML = invites.map(invite => `
            <div class="p-3 bg-gray-700 rounded-lg mb-2">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="font-medium text-white">${invite.from.name}</h3>
                        <p class="text-sm text-gray-400">Invited you to play ${invite.gameType}</p>
                        <p class="text-xs text-gray-500">${this.formatTime(invite.timestamp)}</p>
                    </div>
                    <div class="flex space-x-2">
                        <button class="accept-invite bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm" data-invite-id="${invite.id}">
                            Accept
                        </button>
                        <button class="decline-invite bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm" data-invite-id="${invite.id}">
                            Decline
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners for invite actions
        this.invitesList.querySelectorAll('.accept-invite').forEach(button => {
            button.addEventListener('click', (e) => {
                const inviteId = (e.currentTarget as HTMLElement).dataset.inviteId;
                if (inviteId) this.handleInviteResponse(inviteId, 'accept');
            });
        });

        this.invitesList.querySelectorAll('.decline-invite').forEach(button => {
            button.addEventListener('click', (e) => {
                const inviteId = (e.currentTarget as HTMLElement).dataset.inviteId;
                if (inviteId) this.handleInviteResponse(inviteId, 'decline');
            });
        });
    }

    private renderSearchResults(users: ChatUser[]): void {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;

        searchResults.classList.remove('hidden');

        if (users.length === 0) {
            searchResults.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">🔍</div>
                    <p class="text-gray-400">No users found</p>
                </div>
            `;
            return;
        }

        searchResults.innerHTML = users.map(user => `
            <div class="p-3 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors search-user" data-user-id="${user.id}">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span class="font-bold text-white">${user.name[0].toUpperCase()}</span>
                    </div>
                    <div>
                        <h3 class="font-medium text-white">${user.name}</h3>
                        <p class="text-sm text-gray-400">${user.email}</p>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click listeners
        searchResults.querySelectorAll('.search-user').forEach(element => {
            element.addEventListener('click', (e) => {
                const userId = (e.currentTarget as HTMLElement).dataset.userId;
                const user = users.find(u => u.id === userId);
                if (user) {
                    this.selectChatUser(user);
                    this.searchInput!.value = '';
                    searchResults.classList.add('hidden');
                }
            });
        });
    }

    private selectChatUser(user: ChatUser): void {
        this.selectedChatUser = user;
        this.showChatInterface();
        this.loadMessagesForUser(user.id);
    }

    private showChatInterface(): void {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const messagesArea = document.getElementById('messagesArea');
        const chatHeader = document.getElementById('chatHeader');

        welcomeScreen?.classList.add('hidden');
        messagesArea?.classList.remove('hidden');
        chatHeader?.classList.remove('hidden');

        // Update chat header
        this.updateChatHeader();
    }

    private showWelcomeScreen(): void {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const messagesArea = document.getElementById('messagesArea');
        const chatHeader = document.getElementById('chatHeader');

        welcomeScreen?.classList.remove('hidden');
        messagesArea?.classList.add('hidden');
        chatHeader?.classList.add('hidden');
    }

    private updateChatHeader(): void {
        if (!this.selectedChatUser) return;

        const chatUserAvatar = document.getElementById('chatUserAvatar');
        const chatUsername = document.getElementById('chatUsername');
        const chatUserStatus = document.getElementById('chatUserStatus');

        if (chatUserAvatar) {
            chatUserAvatar.innerHTML = `<span class="font-bold text-white">${this.selectedChatUser.name[0].toUpperCase()}</span>`;
        }

        if (chatUsername) {
            chatUsername.textContent = this.selectedChatUser.name;
        }

        if (chatUserStatus) {
            chatUserStatus.textContent = this.selectedChatUser.isOnline ? 'Online' : 'Offline';
            chatUserStatus.className = this.selectedChatUser.isOnline ? 'text-sm text-green-400' : 'text-sm text-gray-400';
        }
    }

    private async loadMessagesForUser(userId: string): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.CHAT}/messages/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const messages = await response.json();
                this.renderMessages(messages);
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    private renderMessages(messages: ChatMessage[]): void {
        if (!this.messagesContainer) return;

        this.messagesContainer.innerHTML = messages.map(message => {
            const isOwnMessage = message.senderId === this.currentUser?.id;
            return `
                <div class="flex ${isOwnMessage ? 'justify-end' : 'justify-start'} message-enter">
                    <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${isOwnMessage ? 'bg-purple-600 text-white' : 'bg-gray-700 text-white'}">
                        <p class="text-sm">${this.escapeHtml(message.content)}</p>
                        <p class="text-xs mt-1 ${isOwnMessage ? 'text-purple-200' : 'text-gray-400'}">${this.formatTime(message.timestamp)}</p>
                    </div>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        this.scrollToBottom();
    }

    private addMessageToChat(message: ChatMessage): void {
        if (!this.messagesContainer) return;

        const isOwnMessage = message.senderId === this.currentUser?.id;
        const messageElement = document.createElement('div');
        messageElement.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'} message-enter`;
        messageElement.innerHTML = `
            <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${isOwnMessage ? 'bg-purple-600 text-white' : 'bg-gray-700 text-white'}">
                <p class="text-sm">${this.escapeHtml(message.content)}</p>
                <p class="text-xs mt-1 ${isOwnMessage ? 'text-purple-200' : 'text-gray-400'}">${this.formatTime(message.timestamp)}</p>
            </div>
        `;

        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    private handleIncomingMessage(message: ChatMessage): void {
        // Add to current chat if it's from the selected user
        if (this.selectedChatUser && message.senderId === this.selectedChatUser.id) {
            this.addMessageToChat(message);
        }

        // Update chat list
        this.loadChatUsers();
    }

    private handleTypingIndicator(data: any): void {
        if (this.selectedChatUser && data.senderId === this.selectedChatUser.id) {
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) {
                if (data.isTyping) {
                    typingIndicator.classList.remove('hidden');
                } else {
                    typingIndicator.classList.add('hidden');
                }
            }
        }
    }

    private handleUserOnline(user: ChatUser): void {
        // Update user status in lists
        this.loadOnlineUsers();
    }

    private handleUserOffline(user: ChatUser): void {
        // Update user status in lists
        this.loadOnlineUsers();
    }

    private handleGameInvite(invite: any): void {
        showNotification(`${invite.from.name} invited you to play ${invite.gameType}!`, 'info');
        this.loadGameInvites();
    }

    private async handleInviteResponse(inviteId: string, action: 'accept' | 'decline'): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.GAME}/invite/${inviteId}/${action}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                showNotification(`Invite ${action}ed successfully`, 'success');
                
                if (action === 'accept') {
                    // Navigate to game
                    const event = new CustomEvent('navigate', {
                        detail: { path: '/game' }
                    });
                    window.dispatchEvent(event);
                }
                
                this.loadGameInvites();
            }
        } catch (error) {
            console.error(`Failed to ${action} invite:`, error);
            showError(`Failed to ${action} invite`);
        }
    }

    private updateConnectionStatus(status: string): void {
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.textContent = status;
            connectionStatus.className = status === 'Connected' ? 'text-xs text-green-400' : 'text-xs text-red-400';
        }
    }

    private scrollToBottom(): void {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    private formatTime(timestamp: string | Date): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString();
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
        let timeoutId: ReturnType<typeof setTimeout>;
        return (...args: Parameters<T>) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
}