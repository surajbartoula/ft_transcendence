import { Page } from '../router/Router';
import { showError, hideError, showNotification, formatDate, generateAvatarUrl, escapeHtml } from '../utils/ui';
import { getStoredToken, getStoredUser } from '../utils/auth';
import { io, Socket } from 'socket.io-client';

interface User {
    user_id: string;
    username: string;
    display_name: string;
    bio?: string;
    photo?: string;
    created_at: string;
}

interface Friend extends User {
    friendship_date?: string;
    is_online?: boolean;
    last_seen?: string;
}

interface Message {
    id: number;
    sender_id: string;
    receiver_id: string;
    content: string;
    message_type: string;
    created_at: string;
    read_at?: string;
    sender_profile?: User;
}

interface Chat {
    friend: User;
    last_message: string;
    last_message_time: string;
    last_message_sender: string;
    unread_count: number;
    is_last_message_mine: boolean;
}

interface FriendRequest {
    user_id: string;
    username: string;
    display_name: string;
    photo?: string;
    request_date: string;
}

export class ChatPage implements Page {
    title = 'Chat';
    requiresAuth = true;
    
    private socket: Socket | null = null;
    private currentUser: any = null;
    private currentChatFriend: User | null = null;
    private messages: Message[] = [];
    private friends: Friend[] = [];
    private chats: Chat[] = [];
    private friendRequests: FriendRequest[] = [];
    private isTyping: { [userId: string]: boolean } = {};
    private typingTimeout: { [userId: string]: NodeJS.Timeout } = {};

    render(): string {
        return `
            <div class="h-screen bg-gray-900 flex overflow-hidden">
                <!-- Sidebar -->
                <div class="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
                    <!-- Header -->
					<button data-route="/dashboard" class="text-gray-400 hover:text-white transition-colors items-center justify-center h-18 p-4">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
						</svg>
					</button>
                    <div class="p-4 border-b border-gray-700">
                        <div class="flex items-center justify-between mb-4">
                            <h1 class="text-xl font-semibold text-white">Messages</h1>
                            <button id="addFriendBtn" class="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                </svg>
                            </button>
                        </div>
                        
                        <!-- Tabs -->
                        <div class="flex space-x-1 bg-gray-700 rounded-lg p-1">
                            <button id="chatsTab" class="flex-1 py-2 px-3 rounded-md text-sm font-medium text-white bg-gray-600 transition-colors">
                                Chats
                                <span id="unreadBadge" class="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1 hidden">0</span>
                            </button>
                            <button id="friendsTab" class="flex-1 py-2 px-3 rounded-md text-sm font-medium text-gray-300 hover:text-white transition-colors">
                                Friends
                            </button>
                            <button id="requestsTab" class="flex-1 py-2 px-3 rounded-md text-sm font-medium text-gray-300 hover:text-white transition-colors">
                                Requests
                                <span id="requestsBadge" class="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1 hidden">0</span>
                            </button>
                        </div>
                    </div>

                    <!-- Search -->
                    <div class="p-4 border-b border-gray-700">
                        <div class="relative">
                            <input id="searchInput" type="text" placeholder="Search users..." 
                                   class="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <svg class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                        <div id="searchResults" class="mt-2 space-y-2 hidden"></div>
                    </div>

                    <!-- Content Lists -->
                    <div class="flex-1 overflow-y-auto">
                        <!-- Chats List -->
                        <div id="chatsList" class="p-4 space-y-2">
                            <div class="text-center text-gray-400 py-8">
                                <svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.998-.508c-.738-.187-1.462-.375-2.175-.555a3 3 0 00-3.08.652L2 22l1.56-2.747a3 3 0 00.652-3.08c-.18-.713-.368-1.437-.555-2.175A8.955 8.955 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"></path>
                                </svg>
                                <p>No chats yet</p>
                                <p class="text-sm">Start a conversation with a friend!</p>
                            </div>
                        </div>

                        <!-- Friends List -->
                        <div id="friendsList" class="p-4 space-y-2 hidden">
                            <div class="text-center text-gray-400 py-8">
                                <svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                                <p>No friends yet</p>
                                <p class="text-sm">Add friends to start chatting!</p>
                            </div>
                        </div>

                        <!-- Requests List -->
                        <div id="requestsList" class="p-4 space-y-2 hidden">
                            <div class="text-center text-gray-400 py-8">
                                <svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                                </svg>
                                <p>No friend requests</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Chat Area -->
                <div class="flex-1 flex flex-col">
                    <!-- Chat Header -->
                    <div id="chatHeader" class="bg-gray-800 border-b border-gray-700 p-4 hidden">
                        <div class="flex items-center">
                            <img id="chatAvatar" class="w-10 h-10 rounded-full mr-3" src="" alt="">
                            <div class="flex-1">
                                <h2 id="chatName" class="text-white font-semibold"></h2>
                                <p id="chatStatus" class="text-sm text-gray-400"></p>
                            </div>
                            <button id="closeChatBtn" class="text-gray-400 hover:text-white p-2">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Welcome Screen -->
                    <div id="welcomeScreen" class="flex-1 flex items-center justify-center bg-gray-900">
                        <div class="text-center">
                            <svg class="w-20 h-20 mx-auto mb-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.998-.508c-.738-.187-1.462-.375-2.175-.555a3 3 0 00-3.08.652L2 22l1.56-2.747a3 3 0 00.652-3.08c-.18-.713-.368-1.437-.555-2.175A8.955 8.955 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"></path>
                            </svg>
                            <h2 class="text-2xl font-semibold text-white mb-2">Welcome to Chat</h2>
                            <p class="text-gray-400">Select a conversation or start a new one</p>
                        </div>
                    </div>

                    <!-- Messages Area -->
                    <div id="messagesArea" class="flex-1 flex flex-col hidden">
                        <div id="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3">
                            <!-- Messages will be inserted here -->
                        </div>

                        <!-- Typing Indicator -->
                        <div id="typingIndicator" class="px-4 pb-2 hidden">
                            <div class="flex items-center text-gray-400 text-sm">
                                <div class="flex space-x-1 mr-2">
                                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                                </div>
                                <span id="typingText">Someone is typing...</span>
                            </div>
                        </div>

                        <!-- Message Input -->
                        <div class="border-t border-gray-700 p-4">
                            <div class="flex items-center space-x-3">
                                <div class="flex-1 relative">
                                    <input id="messageInput" type="text" placeholder="Type a message..." 
                                           class="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <button id="sendBtn" class="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-400 disabled:text-gray-500 disabled:cursor-not-allowed">
                                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Add Friend Modal -->
                <div id="addFriendModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                    <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 class="text-lg font-semibold text-white mb-4">Add Friend</h3>
                        <input id="friendSearchInput" type="text" placeholder="Search by username..." 
                               class="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <div id="friendSearchResults" class="space-y-2 mb-4 max-h-60 overflow-y-auto"></div>
                        <div class="flex justify-end space-x-3">
                            <button id="cancelAddFriend" class="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize(): Promise<void> {
        hideError();
        this.currentUser = getStoredUser();
        if (!this.currentUser) {
            showError('Please log in to access chat');
            return;
        }
        await this.initializeSocket();
        this.setupEventListeners();
        await this.loadInitialData();
    }

    cleanup(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        /** Clear typing timeouts */
        Object.values(this.typingTimeout).forEach(timeout => clearTimeout(timeout));
        this.typingTimeout = {};
    }

    private async initializeSocket(): Promise<void> {
        const token = getStoredToken();
        if (!token) return;

        this.socket = io('http://localhost:3003', {
            auth: { token }
        });

        this.socket.on('connect', () => {
            console.log('Connected to chat service');
            /** Send heartbeat every 30 seconds */
            setInterval(() => {
                this.socket?.emit('heartbeat');
            }, 30000);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from chat service');
        });

        this.socket.on('new_message', (data: Message & { sender_profile: User }) => {
            this.handleNewMessage(data);
        });

        this.socket.on('friend_request', (data: { from_user: User; message: string }) => {
            showNotification(data.message, 'info');
            this.loadFriendRequests();
        });

        this.socket.on('friend_request_accepted', (data: { from_user: User; message: string }) => {
            showNotification(data.message, 'success');
            this.loadFriends();
        });

        this.socket.on('user_typing', (data: { user_id: string }) => {
            this.handleTypingStart(data.user_id);
        });

        this.socket.on('user_stopped_typing', (data: { user_id: string }) => {
            this.handleTypingStop(data.user_id);
        });

        this.socket.on('error', (data: { message: string }) => {
            showError(data.message);
        });
    }

    private setupEventListeners(): void {
        /** Tab switching */
        document.getElementById('chatsTab')?.addEventListener('click', () => this.switchTab('chats'));
        document.getElementById('friendsTab')?.addEventListener('click', () => this.switchTab('friends'));
        document.getElementById('requestsTab')?.addEventListener('click', () => this.switchTab('requests'));
        /** Search */
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        searchInput?.addEventListener('input', this.debounce(() => this.handleSearch(searchInput.value), 300));
        /** Message input */
        const messageInput = document.getElementById('messageInput') as HTMLInputElement;
        messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });
        messageInput?.addEventListener('input', () => {
            this.handleTyping();
        });
        /** Send button */
        document.getElementById('sendBtn')?.addEventListener('click', () => this.sendMessage());
        /** Close chat */
        document.getElementById('closeChatBtn')?.addEventListener('click', () => this.closeChat());
        /** Add friend modal */
        document.getElementById('addFriendBtn')?.addEventListener('click', () => this.showAddFriendModal());
        document.getElementById('cancelAddFriend')?.addEventListener('click', () => this.hideAddFriendModal());
        /** Friend search in modal */
        const friendSearchInput = document.getElementById('friendSearchInput') as HTMLInputElement;
        friendSearchInput?.addEventListener('input', this.debounce(() => this.searchUsersForFriend(friendSearchInput.value), 300));
    }

    private async loadInitialData(): Promise<void> {
        try {
            await Promise.all([
                this.loadChats(),
                this.loadFriends(),
                this.loadFriendRequests()
            ]);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            showError('Failed to load chat data');
        }
    }

    private async loadChats(): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('http://localhost:3003/api/chats/recent', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load chats');
            this.chats = await response.json();
            this.renderChats();
            this.updateUnreadBadge();
        } catch (error) {
            console.error('Failed to load chats:', error);
        }
    }

    private async loadFriends(): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('http://localhost:3003/api/friends/details', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load friends');
            this.friends = await response.json();
            this.renderFriends();
        } catch (error) {
            console.error('Failed to load friends:', error);
        }
    }

    private async loadFriendRequests(): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('http://localhost:3003/api/friends/requests/details', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load friend requests');
            this.friendRequests = await response.json();
            this.renderFriendRequests();
            this.updateRequestsBadge();
        } catch (error) {
            console.error('Failed to load friend requests:', error);
        }
    }

    private switchTab(tab: 'chats' | 'friends' | 'requests'): void {
        /** Update tab buttons */
        document.querySelectorAll('[id$="Tab"]').forEach(btn => {
            btn.classList.remove('bg-gray-600', 'text-white');
            btn.classList.add('text-gray-300');
        });
        const activeTab = document.getElementById(`${tab}Tab`);
        activeTab?.classList.add('bg-gray-600', 'text-white');
        activeTab?.classList.remove('text-gray-300');
        /** Show/hide content */
        document.getElementById('chatsList')?.classList.add('hidden');
        document.getElementById('friendsList')?.classList.add('hidden');
        document.getElementById('requestsList')?.classList.add('hidden');
        document.getElementById(`${tab}List`)?.classList.remove('hidden');
    }

    private renderChats(): void {
        const container = document.getElementById('chatsList');
        if (!container) return;
        if (this.chats.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.998-.508c-.738-.187-1.462-.375-2.175-.555a3 3 0 00-3.08.652L2 22l1.56-2.747a3 3 0 00.652-3.08c-.18-.713-.368-1.437-.555-2.175A8.955 8.955 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"></path>
                    </svg>
                    <p>No chats yet</p>
                    <p class="text-sm">Start a conversation with a friend!</p>
                </div>
            `;
            return;
        }
        container.innerHTML = this.chats.map(chat => `
            <div class="chat-item p-3 rounded-lg bg-gray-700 hover:bg-gray-600 cursor-pointer transition-colors" 
                 data-friend-id="${chat.friend.user_id}">
                <div class="flex items-center">
                    <img class="w-12 h-12 rounded-full mr-3" 
                         src="${chat.friend.photo || generateAvatarUrl(chat.friend.display_name)}" 
                         alt="${chat.friend.display_name}">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <p class="font-medium text-white truncate">${escapeHtml(chat.friend.display_name)}</p>
                            <span class="text-xs text-gray-400">${formatDate(chat.last_message_time)}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <p class="text-sm text-gray-400 truncate">
                                ${chat.is_last_message_mine ? 'You: ' : ''}${escapeHtml(chat.last_message)}
                            </p>
                            ${chat.unread_count > 0 ? `
                                <span class="bg-blue-500 text-white text-xs rounded-full px-2 py-1 ml-2">
                                    ${chat.unread_count}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        /** Add click listeners */
        container.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const friendId = item.getAttribute('data-friend-id');
                const friend = this.chats.find(c => c.friend.user_id === friendId)?.friend;
                if (friend) this.openChat(friend);
            });
        });
    }

    private renderFriends(): void {
        const container = document.getElementById('friendsList');
        if (!container) return;
        if (this.friends.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    <p>No friends yet</p>
                    <p class="text-sm">Add friends to start chatting!</p>
                </div>
            `;
            return;
        }
        container.innerHTML = this.friends.map(friend => `
            <div class="friend-item p-3 rounded-lg bg-gray-700 hover:bg-gray-600 cursor-pointer transition-colors" 
                 data-friend-id="${friend.user_id}">
                <div class="flex items-center">
                    <div class="relative">
                        <img class="w-12 h-12 rounded-full mr-3" 
                             src="${friend.photo || generateAvatarUrl(friend.display_name)}" 
                             alt="${friend.display_name}">
                        ${friend.is_online ? `
                            <div class="absolute bottom-0 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-700"></div>
                        ` : ''}
                    </div>
                    <div class="flex-1">
                        <p class="font-medium text-white">${escapeHtml(friend.display_name)}</p>
                        <p class="text-sm text-gray-400">
                            ${friend.is_online ? 'Online' : `Last seen ${formatDate(friend.last_seen || friend.created_at)}`}
                        </p>
                    </div>
                </div>
            </div>
        `).join('');
        container.querySelectorAll('.friend-item').forEach(item => {
            item.addEventListener('click', () => {
                const friendId = item.getAttribute('data-friend-id');
                const friend = this.friends.find(f => f.user_id === friendId);
                if (friend) this.openChat(friend);
            });
        });
    }

    private renderFriendRequests(): void {
        const container = document.getElementById('requestsList');
        if (!container) return;
        if (this.friendRequests.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                    </svg>
                    <p>No friend requests</p>
                </div>
            `;
            return;
        }
        container.innerHTML = this.friendRequests.map(request => `
            <div class="p-3 rounded-lg bg-gray-700">
                <div class="flex items-center mb-3">
                    <img class="w-10 h-10 rounded-full mr-3" 
                         src="${request.photo || generateAvatarUrl(request.display_name)}" 
                         alt="${request.display_name}">
                    <div class="flex-1">
                        <p class="font-medium text-white">${escapeHtml(request.display_name)}</p>
                        <p class="text-xs text-gray-400">${formatDate(request.request_date)}</p>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button class="accept-request flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded transition-colors" 
                            data-user-id="${request.user_id}">
                        Accept
                    </button>
                    <button class="decline-request flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded transition-colors" 
                            data-user-id="${request.user_id}">
                        Decline
                    </button>
                </div>
            </div>
        `).join('');
        /** Add click listeners for accept/decline */
        container.querySelectorAll('.accept-request').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.getAttribute('data-user-id');
                if (userId) await this.acceptFriendRequest(userId);
            });
        });
        container.querySelectorAll('.decline-request').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.getAttribute('data-user-id');
                if (userId) await this.declineFriendRequest(userId);
            });
        });
    }

    private async openChat(friend: User): Promise<void> {
        this.currentChatFriend = friend;
        this.messages = [];
        /** Update UI */
        document.getElementById('welcomeScreen')?.classList.add('hidden');
        document.getElementById('chatHeader')?.classList.remove('hidden');
        document.getElementById('messagesArea')?.classList.remove('hidden');
        /** Update chat header */
        const chatAvatar = document.getElementById('chatAvatar') as HTMLImageElement;
        const chatName = document.getElementById('chatName');
        const chatStatus = document.getElementById('chatStatus');
        if (chatAvatar) chatAvatar.src = friend.photo || generateAvatarUrl(friend.display_name);
        if (chatName) chatName.textContent = friend.display_name;
        if (chatStatus) chatStatus.textContent = 'Online'; // TODO: Get real status
        /** Load messages */
        await this.loadMessages(friend.user_id);
        this.scrollToBottom();
    }

    private closeChat(): void {
        this.currentChatFriend = null;
        this.messages = [];
        document.getElementById('welcomeScreen')?.classList.remove('hidden');
        document.getElementById('chatHeader')?.classList.add('hidden');
        document.getElementById('messagesArea')?.classList.add('hidden');
    }

    private async loadMessages(friendId: string): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch(`http://localhost:3003/api/messages/${friendId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load messages');
            this.messages = await response.json();
            this.renderMessages();
        } catch (error) {
            console.error('Failed to load messages:', error);
            showError('Failed to load messages');
        }
    }

    private renderMessages(): void {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        container.innerHTML = this.messages.map(message => {
            const isOwn = message.sender_id === this.currentUser.user_id;
            return `
                <div class="flex ${isOwn ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isOwn 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-700 text-white'
                    }">
                        <p class="text-sm">${escapeHtml(message.content)}</p>
                        <p class="text-xs ${isOwn ? 'text-blue-200' : 'text-gray-400'} mt-1">
                            ${formatDate(message.created_at)}
                        </p>
                    </div>
                </div>
            `;
        }).join('');
    }

    private async sendMessage(): Promise<void> {
        const input = document.getElementById('messageInput') as HTMLInputElement;
        const content = input.value.trim();
        if (!content || !this.currentChatFriend || !this.socket) return;
        /** Clear input */
        input.value = '';
        /** Send via socket */
        this.socket.emit('send_message', {
            receiver_id: this.currentChatFriend.user_id,
            content,
            message_type: 'text'
        });
        const tempMessage: Message = {
            id: Date.now(),
            sender_id: this.currentUser.user_id,
            receiver_id: this.currentChatFriend.user_id,
            content,
            message_type: 'text',
            created_at: new Date().toISOString()
        };
        this.messages.push(tempMessage);
        this.renderMessages();
        this.scrollToBottom();
        this.stopTyping();
    }

    private handleNewMessage(messageData: Message & { sender_profile: User }): void {
        /** If chat is open with this user, add message */
        if (this.currentChatFriend && messageData.sender_id === this.currentChatFriend.user_id) {
            this.messages.push(messageData);
            this.renderMessages();
            this.scrollToBottom();
        }
        /** Update chats list */
        this.loadChats();
        /** Show notification if chat is not open or window is not focused */
        if (!this.currentChatFriend || messageData.sender_id !== this.currentChatFriend.user_id || !document.hasFocus()) {
            showNotification(
                `${messageData.sender_profile.display_name}: ${messageData.content}`,
                'info',
                5000
            );
        }
    }

    private handleTyping(): void {
        if (!this.currentChatFriend || !this.socket) return;
        this.socket.emit('typing_start', {
            receiver_id: this.currentChatFriend.user_id
        });
        /** Clear existing timeout */
        if (this.typingTimeout[this.currentChatFriend.user_id]) {
            clearTimeout(this.typingTimeout[this.currentChatFriend.user_id]);
        }
        /** Set new timeout to stop typing */
        this.typingTimeout[this.currentChatFriend.user_id] = setTimeout(() => {
            this.stopTyping();
        }, 2000);
    }

    private stopTyping(): void {
        if (!this.currentChatFriend || !this.socket) return;
        this.socket.emit('typing_stop', {
            receiver_id: this.currentChatFriend.user_id
        });
        if (this.typingTimeout[this.currentChatFriend.user_id]) {
            clearTimeout(this.typingTimeout[this.currentChatFriend.user_id]);
            delete this.typingTimeout[this.currentChatFriend.user_id];
        }
    }

    private handleTypingStart(userId: string): void {
        if (this.currentChatFriend && userId === this.currentChatFriend.user_id) {
            this.isTyping[userId] = true;
            this.updateTypingIndicator();
        }
    }

    private handleTypingStop(userId: string): void {
        delete this.isTyping[userId];
        this.updateTypingIndicator();
    }

    private updateTypingIndicator(): void {
        const indicator = document.getElementById('typingIndicator');
        const typingText = document.getElementById('typingText');
        if (!indicator || !typingText) return;
        const typingUsers = Object.keys(this.isTyping);
        if (typingUsers.length > 0) {
            typingText.textContent = `${this.currentChatFriend?.display_name} is typing...`;
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }

    private async handleSearch(query: string): Promise<void> {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        if (query.length < 2) {
            resultsContainer.classList.add('hidden');
            resultsContainer.innerHTML = '';
            return;
        }
        try {
            const token = getStoredToken();
            const response = await fetch(`http://localhost:3003/api/users/search?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Search failed');
            const users = await response.json();
            if (users.length === 0) {
                resultsContainer.innerHTML = '<p class="text-gray-400 text-sm p-2">No users found</p>';
            } else {
                resultsContainer.innerHTML = users.map((user: User) => `
                    <div class="search-result p-2 rounded bg-gray-600 hover:bg-gray-500 cursor-pointer transition-colors" 
                         data-user-id="${user.user_id}">
                        <div class="flex items-center">
                            <img class="w-8 h-8 rounded-full mr-2" 
                                 src="${user.photo || generateAvatarUrl(user.display_name)}" 
                                 alt="${user.display_name}">
                            <div>
                                <p class="text-white text-sm font-medium">${escapeHtml(user.display_name)}</p>
                                <p class="text-gray-400 text-xs">@${escapeHtml(user.username)}</p>
                            </div>
                        </div>
                    </div>
                `).join('');
                resultsContainer.querySelectorAll('.search-result').forEach(item => {
                    item.addEventListener('click', async () => {
                        const userId = item.getAttribute('data-user-id');
                        if (userId) await this.sendFriendRequest(userId);
                    });
                });
            }
            resultsContainer.classList.remove('hidden');
        } catch (error) {
            console.error('Search failed:', error);
            resultsContainer.innerHTML = '<p class="text-red-400 text-sm p-2">Search failed</p>';
            resultsContainer.classList.remove('hidden');
        }
    }

    private async sendFriendRequest(userId: string): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('http://localhost:3003/api/friends/request', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ target_user_id: userId })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send friend request');
            }
            showNotification('Friend request sent!', 'success');
            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            if (searchInput) searchInput.value = '';
            document.getElementById('searchResults')?.classList.add('hidden');
        } catch (error) {
            console.error('Failed to send friend request:', error);
            showError(error instanceof Error ? error.message : 'Failed to send friend request');
        }
    }

    private async acceptFriendRequest(userId: string): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('http://localhost:3003/api/friends/accept', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ requester_id: userId })
            });
            if (!response.ok) throw new Error('Failed to accept friend request');
            showNotification('Friend request accepted!', 'success');
            await this.loadFriendRequests();
            await this.loadFriends();
        } catch (error) {
            console.error('Failed to accept friend request:', error);
            showError('Failed to accept friend request');
        }
    }

    private async declineFriendRequest(userId: string): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('http://localhost:3003/api/friends/decline', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ requester_id: userId })
            });
            if (!response.ok) throw new Error('Failed to decline friend request');
            showNotification('Friend request declined', 'info');
            await this.loadFriendRequests();
        } catch (error) {
            console.error('Failed to decline friend request:', error);
            showError('Failed to decline friend request');
        }
    }

    private showAddFriendModal(): void {
        document.getElementById('addFriendModal')?.classList.remove('hidden');
    }

    private hideAddFriendModal(): void {
        document.getElementById('addFriendModal')?.classList.add('hidden');
        /** Clear search */
        const input = document.getElementById('friendSearchInput') as HTMLInputElement;
        if (input) input.value = '';
        document.getElementById('friendSearchResults')!.innerHTML = '';
    }

    private async searchUsersForFriend(query: string): Promise<void> {
        const resultsContainer = document.getElementById('friendSearchResults');
        if (!resultsContainer) return;
        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }
        try {
            const token = getStoredToken();
            const response = await fetch(`http://localhost:3003/api/users/search?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Search failed');
            const users = await response.json();
            if (users.length === 0) {
                resultsContainer.innerHTML = '<p class="text-gray-400 text-sm p-2">No users found</p>';
            } else {
                resultsContainer.innerHTML = users.map((user: User) => `
                    <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div class="flex items-center">
                            <img class="w-10 h-10 rounded-full mr-3" 
                                 src="${user.photo || generateAvatarUrl(user.display_name)}" 
                                 alt="${user.display_name}">
                            <div>
                                <p class="text-white font-medium">${escapeHtml(user.display_name)}</p>
                                <p class="text-gray-400 text-sm">@${escapeHtml(user.username)}</p>
                            </div>
                        </div>
                        <button class="send-request bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors" 
                                data-user-id="${user.user_id}">
                            Add Friend
                        </button>
                    </div>
                `).join('');
                resultsContainer.querySelectorAll('.send-request').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const userId = btn.getAttribute('data-user-id');
                        if (userId) {
                            await this.sendFriendRequest(userId);
                            this.hideAddFriendModal();
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Search failed:', error);
            resultsContainer.innerHTML = '<p class="text-red-400 text-sm p-2">Search failed</p>';
        }
    }

    private updateUnreadBadge(): void {
        const badge = document.getElementById('unreadBadge');
        if (!badge) return;
        const totalUnread = this.chats.reduce((sum, chat) => sum + chat.unread_count, 0);
        if (totalUnread > 0) {
            badge.textContent = totalUnread.toString();
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    private updateRequestsBadge(): void {
        const badge = document.getElementById('requestsBadge');
        if (!badge) return;
        if (this.friendRequests.length > 0) {
            badge.textContent = this.friendRequests.length.toString();
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    private scrollToBottom(): void {
        const container = document.getElementById('messagesContainer');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
    }

    private debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
        let timeoutId: ReturnType<typeof setTimeout>;
        return (...args: Parameters<T>) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
}