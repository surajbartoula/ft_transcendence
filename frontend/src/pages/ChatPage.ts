// pages/ChatPage.ts - Chat page with Socket.io integration
import { Page } from '../router/Router';
import { User } from '../utils/auth';
import { showNotification, showError } from '../utils/ui';
import { API_CONFIG } from '../config';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
    id: string;
    sender_id: string;  // Match the backend field names
    recipient_id: string;
    content: string;
    created_at: string;
    read_at?: string;
    type?: string;
}

interface ChatUser {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    isOnline: boolean;
    lastSeen?: Date;
}

interface GameInvite {
    id: string;
    senderId: string;
    senderUsername: string;
    expiresAt: string;
    status?: string;
}

export class ChatPage implements Page {
    public title = 'Chat';
    public requiresAuth = true;
    
    private currentUser: User | null = null;
    private selectedChatUser: ChatUser | null = null;
    private chatUsers: Map<string, ChatUser> = new Map();
    private messages: ChatMessage[] = [];
    private socket: Socket | null = null;
    
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
    private typingUsers: Set<string> = new Set();

    private boundHandleSearch: ((event: Event) => void) | null = null;
    private boundHandleMessageKeyPress: ((e: KeyboardEvent) => void) | null = null;
    private boundHandleTyping: (() => void) | null = null;
    private boundSendMessage: (() => Promise<void>) | null = null;
    private boundSendGameInvite: (() => Promise<void>) | null = null;
    private boundBlockUser: (() => Promise<void>) | null = null;
    private boundSwitchToChats: (() => void) | null = null;
    private boundSwitchToOnline: (() => void) | null = null;
    private boundSwitchToInvites: (() => void) | null = null;

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
                                    <span id="connectionStatus" class="text-xs text-green-400">Connecting...</span>
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
                                <span id="typingText" class="text-sm">Someone is typing</span>
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
        this.initializeSocketIO();
        await this.loadInitialData();
    }

    public cleanup(): void {
        // Close Socket.io connection
        if (this.socket) {
			this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
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
        // Tab switching - store bound functions
        this.boundSwitchToChats = () => this.switchTab('chats');
        this.boundSwitchToOnline = () => this.switchTab('online');
        this.boundSwitchToInvites = () => this.switchTab('invites');

        const chatsTab = document.getElementById('chatsTab');
        const onlineTab = document.getElementById('onlineTab');
        const invitesTab = document.getElementById('invitesTab');

        chatsTab?.addEventListener('click', this.boundSwitchToChats);
        onlineTab?.addEventListener('click', this.boundSwitchToOnline);
        invitesTab?.addEventListener('click', this.boundSwitchToInvites);

        // Search functionality
        if (this.searchInput) {
            this.boundHandleSearch = this.debounce((event: Event) => {
                const target = event.target as HTMLInputElement;
                this.handleSearch(target.value);
            }, 300) as (event: Event) => void;
            
            this.searchInput.addEventListener('input', this.boundHandleSearch);
        }

        // Message sending
        if (this.messageInput) {
            this.boundHandleMessageKeyPress = this.handleMessageKeyPress.bind(this);
            this.boundHandleTyping = this.handleTyping.bind(this);
            
            this.messageInput.addEventListener('keypress', this.boundHandleMessageKeyPress);
            this.messageInput.addEventListener('input', this.boundHandleTyping);
        }

        if (this.sendButton) {
            this.boundSendMessage = this.sendMessage.bind(this);
            this.sendButton.addEventListener('click', this.boundSendMessage);
        }

        // Game invite and block buttons
        const gameInviteBtn = document.getElementById('gameInviteBtn');
        const blockUserBtn = document.getElementById('blockUserBtn');

        if (gameInviteBtn) {
            this.boundSendGameInvite = this.sendGameInvite.bind(this);
            gameInviteBtn.addEventListener('click', this.boundSendGameInvite);
        }

        if (blockUserBtn) {
            this.boundBlockUser = this.blockUser.bind(this);
            blockUserBtn.addEventListener('click', this.boundBlockUser);
        }
    }

    private removeEventListeners(): void {
        // Remove tab event listeners
        const chatsTab = document.getElementById('chatsTab');
        const onlineTab = document.getElementById('onlineTab');
        const invitesTab = document.getElementById('invitesTab');

        if (chatsTab && this.boundSwitchToChats) {
            chatsTab.removeEventListener('click', this.boundSwitchToChats);
        }
        if (onlineTab && this.boundSwitchToOnline) {
            onlineTab.removeEventListener('click', this.boundSwitchToOnline);
        }
        if (invitesTab && this.boundSwitchToInvites) {
            invitesTab.removeEventListener('click', this.boundSwitchToInvites);
        }

        // Remove search event listener
        if (this.searchInput && this.boundHandleSearch) {
            this.searchInput.removeEventListener('input', this.boundHandleSearch);
        }

        // Remove message input event listeners
        if (this.messageInput) {
            if (this.boundHandleMessageKeyPress) {
                this.messageInput.removeEventListener('keypress', this.boundHandleMessageKeyPress);
            }
            if (this.boundHandleTyping) {
                this.messageInput.removeEventListener('input', this.boundHandleTyping);
            }
        }

        // Remove send button event listener
        if (this.sendButton && this.boundSendMessage) {
            this.sendButton.removeEventListener('click', this.boundSendMessage);
        }

        // Remove game invite and block button event listeners
        const gameInviteBtn = document.getElementById('gameInviteBtn');
        const blockUserBtn = document.getElementById('blockUserBtn');

        if (gameInviteBtn && this.boundSendGameInvite) {
            gameInviteBtn.removeEventListener('click', this.boundSendGameInvite);
        }

        if (blockUserBtn && this.boundBlockUser) {
            blockUserBtn.removeEventListener('click', this.boundBlockUser);
        }

        // Clear references
        this.boundHandleSearch = null;
        this.boundHandleMessageKeyPress = null;
        this.boundHandleTyping = null;
        this.boundSendMessage = null;
        this.boundSendGameInvite = null;
        this.boundBlockUser = null;
        this.boundSwitchToChats = null;
        this.boundSwitchToOnline = null;
        this.boundSwitchToInvites = null;
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

    private initializeSocketIO(): void {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Connect to the gateway
        this.socket = io(API_CONFIG.GATEWAY_URL, {
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to gateway');
            this.updateConnectionStatus('Authenticating...');
            // Send auth event with token
            this.socket?.emit('auth', { token: token });
        });

        this.socket.on('auth:success', () => {
            console.log('Chat authentication successful');
            this.updateConnectionStatus('Connected');
			/** Rejoin current chat room if any */
			if (this.selectedChatUser) {
				this.socket?.emit('chat:join', {userId: this.selectedChatUser.id});
			}
        });

        this.socket.on('auth:error', (error) => {
            console.error('Authentication failed:', error);
            this.updateConnectionStatus('Auth Failed');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from chat server');
            this.updateConnectionStatus('Disconnected');
        });

		this.socket.on('reconnect', () => {
			if (this.selectedChatUser) {
				this.loadChatMessages(this.selectedChatUser.id);
			}
		})

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.updateConnectionStatus('Error');
        });

        // Chat events
        this.socket.on('message:receive', (message) => {
            this.handleIncomingMessage(message);
        });

        this.socket.on('message:sent', (message) => {
            // Confirmation that message was sent
            console.log('Message sent:', message);
        });

        this.socket.on('message:typing', ({ senderId, isTyping }) => {
            this.handleTypingIndicator({ senderId, isTyping });
        });

        this.socket.on('message:read', ({ messageId }) => {
            this.handleMessageRead(messageId);
        });

        // Game invite events
        this.socket.on('game:invite:received', (invite) => {
            this.handleGameInvite(invite);
        });

        this.socket.on('game:invite:sent', ({ inviteId }) => {
            showNotification('Game invite sent!', 'success');
        });

        this.socket.on('game:invite:accepted', ({ inviteId, gameRoomId }) => {
            showNotification('Game invite accepted! Joining game...', 'success');
            // Navigate to game with room ID
            setTimeout(() => {
                const event = new CustomEvent('navigate', {
                    detail: { path: `/game?room=${gameRoomId}` }
                });
                window.dispatchEvent(event);
            }, 1000);
        });

        this.socket.on('game:invite:declined', ({ inviteId }) => {
            showNotification('Game invite was declined', 'info');
        });

        // User status events
        this.socket.on('user:online', ({ userId }) => {
            this.handleUserOnline(userId);
        });

        this.socket.on('user:offline', ({ userId }) => {
            this.handleUserOffline(userId);
        });

        this.socket.on('user:blocked', ({ by }) => {
            showNotification('You have been blocked', 'error');
            if (this.selectedChatUser && this.selectedChatUser.id === by) {
                this.selectedChatUser = null;
                this.showWelcomeScreen();
            }
        });

        // Error handling
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            showError(error.message || 'Connection error');
        });
		// Add token refresh handling
		this.socket.on('auth:token-expired', () => {
			// Handle token refresh or redirect to login
			this.handleTokenExpired();
		});
    }

	private handleTokenExpired(): void {
		localStorage.removeItem('token');
		localStorage.removeItem('userData');
		const event = new CustomEvent('navigate', {
			detail: { path: '/login' }
		});
		window.dispatchEvent(event);
	}

    private async loadInitialData(): Promise<void> {
        try {
            await Promise.all([
                this.loadRecentChats(),
                this.loadOnlineUsers(),
                this.loadGameInvites()
            ]);
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    private async loadRecentChats(): Promise<void> {
        // For now, we'll just show an empty state
        // In a real implementation, you'd load recent conversations
        this.renderChatUsers([]);
    }

    private async loadOnlineUsers(): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.CHAT}/online`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderOnlineUsers(data.users || []);
            }
        } catch (error) {
            console.error('Failed to load online users:', error);
        }
    }

    private async loadGameInvites(): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.CHAT}/game/invites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderGameInvites(data.invites || []);
            }
        } catch (error) {
            console.error('Failed to load game invites:', error);
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

        // Hide search results when switching tabs
        document.getElementById('searchResults')?.classList.add('hidden');
    }

    private async handleSearch(query: string): Promise<void> {
        if (!query.trim()) {
            document.getElementById('searchResults')?.classList.add('hidden');
            // Show the current tab content
            document.getElementById(this.activeTab === 'chats' ? 'chatsList' : 
                                  this.activeTab === 'online' ? 'onlineList' : 'invitesList')?.classList.remove('hidden');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderSearchResults(data.users || []);
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
        if (!this.selectedChatUser || !this.socket) return;

        if (!this.isTyping) {
            this.isTyping = true;
            this.socket.emit('message:typing', {
                recipientId: this.selectedChatUser.id,
                isTyping: true
            });
        }

        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Set new timeout
        this.typingTimeout = window.setTimeout(() => {
            this.isTyping = false;
            if (this.socket && this.selectedChatUser) {
                this.socket.emit('message:typing', {
                    recipientId: this.selectedChatUser.id,
                    isTyping: false
                });
            }
        }, 1000);
    }

	private async sendMessage(): Promise<void> {
		if (!this.messageInput || !this.selectedChatUser || !this.socket) return;

		const content = this.messageInput.value.trim();
		if (!content) return;

		const tempMessage: ChatMessage = {
			id: `temp-${Date.now()}`,
			sender_id: this.currentUser?.id || '',
			recipient_id: this.selectedChatUser.id,
			content,
			created_at: new Date().toISOString(),
			type: 'text'
		};

		// Add to UI optimistically
		this.addMessageToChat(tempMessage);
		this.messageInput.value = '';

		// Send with error handling
		this.socket.emit('message:send', {
			recipientId: this.selectedChatUser.id,
			content,
			type: 'text'
		}, (response: unknown) => {
			if (typeof response === 'object' && response !== null && 'error' in response) {
				// Remove failed message and show error
				this.messages = this.messages.filter(m => m.id !== tempMessage.id);
				this.renderMessages();
				showError('Failed to send message');
				
				// Restore message in input
				if (this.messageInput) {
					this.messageInput.value = content;
				}
			}
		});
	}

    private async sendGameInvite(): Promise<void> {
        if (!this.selectedChatUser || !this.socket) return;

        // Send game invite via Socket.io
        this.socket.emit('game:invite', {
            recipientId: parseInt(this.selectedChatUser.id)
        });
    }

    private async blockUser(): Promise<void> {
        if (!this.selectedChatUser) return;

        const confirmed = confirm(`Are you sure you want to block ${this.selectedChatUser.name}?`);
        if (!confirmed) return;

        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.CHAT}/block/${this.selectedChatUser.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                showNotification('User blocked successfully', 'success');
                this.selectedChatUser = null;
                this.showWelcomeScreen();
                this.loadRecentChats();
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
                            <span class="text-xs text-gray-400">${this.formatTime(conv.lastMessage.created_at)}</span>
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

    private renderGameInvites(invites: GameInvite[]): void {
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
                        <h3 class="font-medium text-white">${invite.senderUsername}</h3>
                        <p class="text-sm text-gray-400">Invited you to play Pong</p>
                        <p class="text-xs text-gray-500">${this.formatTime(invite.expiresAt)}</p>
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
                if (inviteId && this.socket) {
                    this.socket.emit('game:invite:accept', { inviteId: parseInt(inviteId) });
                    this.loadGameInvites(); // Refresh the list
                }
            });
        });

        this.invitesList.querySelectorAll('.decline-invite').forEach(button => {
            button.addEventListener('click', (e) => {
                const inviteId = (e.currentTarget as HTMLElement).dataset.inviteId;
                if (inviteId && this.socket) {
                    this.socket.emit('game:invite:decline', { inviteId: parseInt(inviteId) });
                    this.loadGameInvites(); // Refresh the list
                }
            });
        });
    }

	private renderSearchResults(users: ChatUser[]): void {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;

        // Hide all other lists
        document.getElementById('chatsList')?.classList.add('hidden');
        document.getElementById('onlineList')?.classList.add('hidden');
        document.getElementById('invitesList')?.classList.add('hidden');

        // Show search results
        searchResults.classList.remove('hidden');

        if (users.length === 0) {
            searchResults.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">🔍</div>
                    <p class="text-gray-400">No users found</p>
                    <p class="text-sm text-gray-500 mt-2">Try a different search term</p>
                </div>
            `;
            return;
        }

        searchResults.innerHTML = users.map(user => `
            <div class="p-3 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors search-user" data-user-id="${user.id}">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
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
                }
            });
        });
    }

    private selectChatUser(user: ChatUser): void {
        this.selectedChatUser = user;
        this.chatUsers.set(user.id, user);
        this.showChatInterface();
        this.updateChatHeader(user);
        this.loadChatMessages(user.id);
        
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        this.switchTab('chats');
    }

    private showChatInterface(): void {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const messagesArea = document.getElementById('messagesArea');
        const chatHeader = document.getElementById('chatHeader');
        
        welcomeScreen?.classList.add('hidden');
        messagesArea?.classList.remove('hidden');
        chatHeader?.classList.remove('hidden');
    }

    private showWelcomeScreen(): void {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const messagesArea = document.getElementById('messagesArea');
        const chatHeader = document.getElementById('chatHeader');
        
        welcomeScreen?.classList.remove('hidden');
        messagesArea?.classList.add('hidden');
        chatHeader?.classList.add('hidden');
        
        this.messages = [];
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }
    }

    private updateChatHeader(user: ChatUser): void {
        const chatUserAvatar = document.getElementById('chatUserAvatar')?.querySelector('span');
        const chatUsername = document.getElementById('chatUsername');
        const chatUserStatus = document.getElementById('chatUserStatus');

        if (chatUserAvatar) {
            chatUserAvatar.textContent = user.name[0].toUpperCase();
        }

        if (chatUsername) {
            chatUsername.textContent = user.name;
        }

        if (chatUserStatus) {
            chatUserStatus.textContent = user.isOnline ? 'Online' : 
                (user.lastSeen ? `Last seen ${this.formatTime(user.lastSeen.toISOString())}` : 'Offline');
        }
    }

    private async loadChatMessages(userId: string): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.CHAT}/messages/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.messages = data.messages || [];
                this.renderMessages();
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    private renderMessages(): void {
        if (!this.messagesContainer) return;

        this.messagesContainer.innerHTML = this.messages.map(message => {
            const isOwn = message.sender_id === this.currentUser?.id;
            return `
                <div class="flex ${isOwn ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isOwn ? 'bg-purple-600 text-white' : 'bg-gray-700 text-white'
                    }">
                        <p class="text-sm">${message.content}</p>
                        <p class="text-xs ${isOwn ? 'text-purple-200' : 'text-gray-400'} mt-1">
                            ${this.formatTime(message.created_at)}
                        </p>
                    </div>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    private addMessageToChat(message: ChatMessage): void {
		/** Prevent duplicate message */
		if (this.messages.some(m => m.id === message.id)) return;
        this.messages.push(message);
        this.renderMessages();
    }

    private handleIncomingMessage(message: ChatMessage): void {
		//null check
		if (!message || !this.currentUser) return;
        // Only add if it's for the current chat
        if (this.selectedChatUser && 
            (message.sender_id === this.selectedChatUser.id || message.recipient_id === this.selectedChatUser.id)) {
            this.addMessageToChat(message);
        }

        // Mark as read if chat is open
        if (this.selectedChatUser && message.sender_id === this.selectedChatUser.id && this.socket) {
            this.socket.emit('message:markRead', { messageId: message.id });
        }
    }

    private handleTypingIndicator({ senderId, isTyping }: { senderId: string; isTyping: boolean }): void {
        if (this.selectedChatUser && senderId === this.selectedChatUser.id) {
            if (isTyping) {
                this.typingUsers.add(senderId);
            } else {
                this.typingUsers.delete(senderId);
            }
            this.updateTypingIndicator();
        }
    }

    private updateTypingIndicator(): void {
        const typingIndicator = document.getElementById('typingIndicator');
        const typingText = document.getElementById('typingText');
        
        if (!typingIndicator || !typingText) return;

        if (this.typingUsers.size > 0) {
            typingIndicator.classList.remove('hidden');
            typingText.textContent = `${this.selectedChatUser?.name || 'Someone'} is typing...`;
        } else {
            typingIndicator.classList.add('hidden');
        }
    }

    private handleMessageRead(messageId: string): void {
        const message = this.messages.find(m => m.id === messageId);
        if (message) {
            message.read_at = new Date().toISOString();
            // Optionally update UI to show read status
        }
    }

    private handleGameInvite(invite: GameInvite): void {
        showNotification(`${invite.senderUsername} invited you to play Pong!`, 'info');
        this.loadGameInvites(); // Refresh invites list
    }

    private handleUserOnline(userId: string): void {
        const user = this.chatUsers.get(userId);
        if (user) {
            user.isOnline = true;
            // Update UI if this user is currently selected
            if (this.selectedChatUser && this.selectedChatUser.id === userId) {
                this.updateChatHeader(user);
            }
        }
    }

    private handleUserOffline(userId: string): void {
        const user = this.chatUsers.get(userId);
        if (user) {
            user.isOnline = false;
            user.lastSeen = new Date();
            // Update UI if this user is currently selected
            if (this.selectedChatUser && this.selectedChatUser.id === userId) {
                this.updateChatHeader(user);
            }
        }
    }

    private updateConnectionStatus(status: string): void {
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.textContent = status;
            connectionStatus.className = `text-xs ${
                status === 'Connected' ? 'text-green-400' : 
                status === 'Disconnected' ? 'text-red-400' : 
                'text-yellow-400'
            }`;
        }
    }

    private formatTime(timestamp: string): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            return `${Math.floor(diff / 60000)}m ago`;
        } else if (diff < 86400000) { // Less than 1 day
            return `${Math.floor(diff / 3600000)}h ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    private debounce(func: Function, wait: number): Function {
        let timeout: number;
        return function executedFunction(...args: any[]) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = window.setTimeout(later, wait);
        };
    }
	private initializeSocketIOWithDebug(): void {
		const token = localStorage.getItem('token');
		console.log('🔐 Token exists:', !!token);
		console.log('🌐 Gateway URL:', API_CONFIG.GATEWAY_URL);
		
		if (!token) {
			console.error('❌ No token found');
			return;
		}

		this.socket = io(API_CONFIG.GATEWAY_URL, {
			path: '/socket.io/',
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
			timeout: 10000, // Add timeout
			forceNew: true // Force new connection
		});

		// Enhanced connection debugging
		this.socket.on('connect', () => {
			console.log('✅ Connected to gateway, socket ID:', this.socket?.id);
			this.updateConnectionStatus('Authenticating...');
			
			// Add timeout for auth
			const authTimeout = setTimeout(() => {
				console.error('❌ Auth timeout');
				this.updateConnectionStatus('Auth Timeout');
			}, 5000);
			
			this.socket?.emit('auth', { token: token }, (response: any) => {
				clearTimeout(authTimeout);
				console.log('🔐 Auth response:', response);
			});
		});

		this.socket.on('auth:success', (data: any) => {
			console.log('✅ Authentication successful:', data);
			this.updateConnectionStatus('Connected');
			
			// Join current chat room if any
			if (this.selectedChatUser) {
				console.log('🏠 Rejoining chat room for user:', this.selectedChatUser.id);
				this.socket?.emit('chat:join', {userId: this.selectedChatUser.id});
			}
		});

		this.socket.on('auth:error', (error: any) => {
			console.error('❌ Authentication failed:', error);
			this.updateConnectionStatus('Auth Failed');
			// Redirect to login if auth fails
			setTimeout(() => {
				window.dispatchEvent(new CustomEvent('navigate', { detail: { path: '/login' } }));
			}, 2000);
		});

		// Debug all socket events
		this.socket.onAny((event: string, ...args: any[]) => {
			console.log(`📡 Socket event: ${event}`, args);
		});

		// Debug connection errors
		this.socket.on('connect_error', (error: any) => {
			console.error('❌ Connection error:', error);
			console.log('Error details:', {
				message: error.message,
				description: error.description,
				context: error.context,
				type: error.type
			});
		});

		this.socket.on('disconnect', (reason: string) => {
			console.log('🔌 Disconnected:', reason);
			this.updateConnectionStatus('Disconnected');
		});
	}

	// 2. Enhanced Message Sending with Debug
	private async sendMessageWithDebug(): Promise<void> {
		if (!this.messageInput || !this.selectedChatUser || !this.socket) {
			console.error('❌ Send message failed - missing dependencies:', {
				messageInput: !!this.messageInput,
				selectedChatUser: !!this.selectedChatUser,
				socket: !!this.socket
			});
			return;
		}

		const content = this.messageInput.value.trim();
		if (!content) {
			console.log('⚠️ Empty message content');
			return;
		}

		console.log('📤 Sending message:', {
			to: this.selectedChatUser.id,
			content: content.substring(0, 50) + '...',
			socketConnected: this.socket.connected
		});

		if (!this.socket.connected) {
			console.error('❌ Socket not connected');
			showError('Connection lost. Please refresh and try again.');
			return;
		}

		const tempMessage: ChatMessage = {
			id: `temp-${Date.now()}`,
			sender_id: this.currentUser?.id || '',
			recipient_id: this.selectedChatUser.id,
			content,
			created_at: new Date().toISOString(),
			type: 'text'
		};

		// Add to UI optimistically
		this.addMessageToChat(tempMessage);
		this.messageInput.value = '';

		// Send with enhanced error handling
		const sendPromise = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Message send timeout'));
			}, 10000);

			this.socket?.emit('message:send', {
				recipientId: parseInt(this.selectedChatUser!.id), // Ensure it's a number
				content,
				type: 'text'
			}, (response: any) => {
				clearTimeout(timeout);
				console.log('📤 Message send response:', response);
				
				if (response && response.error) {
					reject(new Error(response.error));
				} else {
					resolve(response);
				}
			});
		});

		try {
			await sendPromise;
			console.log('✅ Message sent successfully');
		} catch (error) {
			console.error('❌ Message send failed:', error);
			
			// Remove failed message and show error
			this.messages = this.messages.filter(m => m.id !== tempMessage.id);
			this.renderMessages();
			showError('Failed to send message: ' + (error as Error).message);
			
			// Restore message in input
			if (this.messageInput) {
				this.messageInput.value = content;
			}
		}
	}

	// 3. Enhanced User Selection with Room Joining
	private selectChatUserWithDebug(user: ChatUser): void {
		console.log('👤 Selecting chat user:', user);
		
		this.selectedChatUser = user;
		this.chatUsers.set(user.id, user);
		this.showChatInterface();
		this.updateChatHeader(user);
		
		// Join chat room
		if (this.socket?.connected) {
			console.log('🏠 Joining chat room for user:', user.id);
			this.socket.emit('chat:join', { userId: user.id }, (response: any) => {
				console.log('🏠 Chat room join response:', response);
			});
		} else {
			console.error('❌ Cannot join chat room - socket not connected');
		}
		
		this.loadChatMessages(user.id);
		
		if (this.searchInput) {
			this.searchInput.value = '';
		}
		this.switchTab('chats');
	}

	// 4. Message Reception Debug
	private handleIncomingMessageWithDebug(message: ChatMessage): void {
		console.log('📥 Incoming message:', {
			id: message.id,
			from: message.sender_id,
			to: message.recipient_id,
			content: message.content.substring(0, 50) + '...',
			selectedUser: this.selectedChatUser?.id
		});

		if (!message || !this.currentUser) {
			console.error('❌ Invalid message or current user');
			return;
		}

		// Only add if it's for the current chat
		if (this.selectedChatUser && 
			(message.sender_id === this.selectedChatUser.id || message.recipient_id === this.selectedChatUser.id)) {
			console.log('✅ Message is for current chat, adding to UI');
			this.addMessageToChat(message);
		} else {
			console.log('ℹ️ Message not for current chat, ignoring');
		}

		// Mark as read if chat is open
		if (this.selectedChatUser && message.sender_id === this.selectedChatUser.id && this.socket) {
			console.log('👁️ Marking message as read');
			this.socket.emit('message:markRead', { messageId: message.id });
		}
	}

	// 5. API Configuration Check
	private debugAPIConfiguration(): void {
		console.log('🔧 API Configuration:', {
			gateway: API_CONFIG.GATEWAY_URL,
			chatEndpoint: API_CONFIG.ENDPOINTS?.CHAT,
			userEndpoint: API_CONFIG.ENDPOINTS?.USER,
			token: localStorage.getItem('token')?.substring(0, 20) + '...'
		});
	}
}
