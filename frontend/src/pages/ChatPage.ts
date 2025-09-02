import { Page } from '../router/Router';
import { showError, hideError, showNotification, formatDate, generateAvatarUrl, escapeHtml } from '../utils/ui';
import { getStoredToken, getStoredUser } from '../utils/auth';
import { API_CONFIG } from '../config';
import globalSocket from '../utils/globalSocket';

interface User {
    user_id: string;
    username: string;
    display_name: string;
    bio?: string;
    photo?: PhotoInfo | null;
    created_at: string;
}

interface PhotoInfo {
    filename: string;
    path: string;
    uploaded_at: string;
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
    photo?: PhotoInfo | null;
    request_date: string;
}

interface BlockedUser {
    user_id: string;
    username: string;
    display_name: string;
    photo?: PhotoInfo | null;
    blocked_date: string;
}

declare global {
    interface WindowEventMap {
        'globalMessage': CustomEvent<any>;
        'openSpecificChat': CustomEvent<{ userId: string }>;
    }
}

export class ChatPage implements Page {
    title = 'Chat';
    requiresAuth = true;
    
    private currentUser: any = null;
    private currentChatFriend: User | null = null;
    private messages: Message[] = [];
    private friends: Friend[] = [];
    private chats: Chat[] = [];
    private friendRequests: FriendRequest[] = [];
    private blockedUsers: BlockedUser[] = [];
    private isTyping: { [userId: string]: boolean } = {};
    private typingTimeout: { [userId: string]: NodeJS.Timeout } = {};
	private isCurrentUserTyping = false;
	private currentUserTypingTimeout: NodeJS.Timeout | null = null;
	private onlineUsers: Set<string> = new Set();

	render(): string {
		return `
			<div class="h-screen bg-gray-900 flex overflow-hidden">
				<!-- Sidebar -->
				<div class="w-96 bg-gray-800 border-r border-gray-700 flex flex-col">
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
						<div class="grid grid-cols-4 gap-1 bg-gray-700 rounded-lg p-1">
							<button id="chatsTab" class="py-2 px-3 rounded-md text-sm font-medium text-white bg-gray-600 transition-colors">
								Chats
								<span id="unreadBadge" class="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-1 hidden">0</span>
							</button>
							<button id="friendsTab" class="py-2 px-3 rounded-md text-sm font-medium text-gray-300 hover:text-white transition-colors">
								Friends
							</button>
							<button id="requestsTab" class="py-2 px-3 rounded-md text-sm font-medium text-gray-300 hover:text-white transition-colors">
								Requests
								<span id="requestsBadge" class="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-1 hidden">0</span>
							</button>
							<button id="blockedTab" class="py-2 px-3 rounded-md text-sm font-medium text-gray-300 hover:text-white transition-colors">
								Blocked
								<span id="blockedBadge" class="ml-1 bg-gray-500 text-white text-xs rounded-full px-2 py-1 hidden">0</span>
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

						<!-- Blocked List -->
						<div id="blockedList" class="p-4 space-y-2 hidden">
							<div class="text-center text-gray-400 py-8">
								<svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636a9 9 0 00-12.728 0M5.636 18.364a9 9 0 0012.728 0"></path>
								</svg>
								<p>No blocked users</p>
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
							<div class="flex items-center space-x-2">
								<button id="viewProfileBtn" class="bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-1.5 rounded-md hidden transition-colors" title="View Profile">
									👤 Profile
								</button>
								<button id="gameInviteBtn" class="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-md hidden transition-colors" title="Challenge to a Game">
									🏓 Challenge
								</button>
								<button id="blockBtn" class="text-red-400 hover:text-red-300 p-2" title="Block User">
									<img class="w-5 h-5 filter brightness-0 invert opacity-70 hover:opacity-100" src="/block-user.svg" alt="Block">
								</button>
								<button id="unblockBtn" class="text-green-400 hover:text-green-300 p-2 hidden" title="Unblock User">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
									</svg>
								</button>
								<button id="closeChatBtn" class="text-gray-400 hover:text-white p-2">
									<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
									</svg>
								</button>
							</div>
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

					<!-- Messages Area - FIXED STRUCTURE -->
					<div id="messagesArea" class="flex-1 flex flex-col hidden min-h-0">
						<!-- Messages Container - Takes available space and scrolls -->
						<div id="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
							<!-- Messages will be inserted here -->
						</div>

						<!-- Typing Indicator - Fixed outside scrollable area -->
						<div id="typingIndicator" class="px-4 pb-2 border-b border-gray-700 bg-gray-900 hidden">
							<div class="flex items-center text-gray-400 text-sm">
								<div class="flex space-x-1 mr-2">
									<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
									<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
									<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
								</div>
								<span id="typingText">Someone is typing...</span>
							</div>
						</div>

						<!-- Message Input - Always at bottom -->
						<div class="border-t border-gray-700 p-4 bg-gray-900">
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

				<!-- Game Invite Modal -->
				<div id="gameInviteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
					<div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
						<h3 class="text-lg font-semibold text-white mb-4">Challenge to a Game</h3>
						<div class="flex items-center mb-4">
							<img id="inviteUserAvatar" class="w-12 h-12 rounded-full mr-3" src="" alt="">
							<div>
								<p id="inviteUserName" class="font-medium text-white"></p>
								<p class="text-sm text-gray-400">Ready to play Pong?</p>
							</div>
						</div>
						<textarea id="gameInviteMessage" 
							placeholder="Optional message..." 
							class="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" 
							rows="3"></textarea>
						<div class="flex justify-end space-x-3">
							<button id="cancelGameInvite" class="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
							<button id="sendGameInvite" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
								<svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
								</svg>
								Send Challenge
							</button>
						</div>
					</div>
				</div>

				<!-- Profile View Modal -->
				<div id="profileModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
					<div class="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
						<div class="flex justify-between items-center mb-6">
							<h3 class="text-xl font-semibold text-white">User Profile</h3>
							<button id="closeProfileModal" class="text-gray-400 hover:text-white text-2xl">&times;</button>
						</div>
						
						<!-- Profile Header -->
						<div class="flex items-center mb-6">
							<div class="relative">
								<img id="profileUserAvatar" class="w-20 h-20 rounded-full object-cover" src="" alt="Profile Avatar">
								<div id="profileUserStatus" class="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-gray-800 rounded-full hidden"></div>
							</div>
							<div class="ml-4">
								<h4 id="profileUserName" class="text-xl font-semibold text-white"></h4>
								<p id="profileUsername" class="text-gray-400">@username</p>
								<p id="profileUserStatusText" class="text-sm text-gray-500"></p>
							</div>
						</div>

						<!-- Profile Details -->
						<div class="space-y-4">
							<!-- Bio Section -->
							<div class="bg-gray-700 rounded-lg p-4">
								<h5 class="text-sm font-medium text-gray-300 mb-2">Bio</h5>
								<p id="profileUserBio" class="text-white text-sm">No bio available</p>
							</div>

							<!-- Member Since -->
							<div class="bg-gray-700 rounded-lg p-4">
								<h5 class="text-sm font-medium text-gray-300 mb-2">Member Since</h5>
								<p id="profileMemberSince" class="text-white text-sm"></p>
							</div>

							<!-- Friendship Info -->
							<div class="bg-gray-700 rounded-lg p-4" id="friendshipInfo" style="display: none;">
								<h5 class="text-sm font-medium text-gray-300 mb-2">Friends Since</h5>
								<p id="profileFriendshipDate" class="text-white text-sm"></p>
							</div>
						</div>

						<!-- Action Buttons -->
						<div class="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-700">
							<button id="profileGameInvite" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
								🏓 Challenge
							</button>
							<button id="closeProfileModalBtn" class="px-4 py-2 text-gray-400 hover:text-white transition-colors">Close</button>
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
        await this.loadInitialData();
        await this.setupGlobalSocketListeners();
        this.setupEventListeners();
		this.handlePendingNavigation();
    }

    cleanup(): void {
        window.removeEventListener('globalMessage', this.handleGlobalMessage);
        window.removeEventListener('openSpecificChat', this.handleOpenSpecificChat);
        window.removeEventListener('game_invitation_response', this.handleGameInvitationResponse as EventListener);
        window.removeEventListener('game_ready', this.handleGameReady as EventListener);
        /** Clear typing timeouts */
        Object.values(this.typingTimeout).forEach(timeout => clearTimeout(timeout));
        this.typingTimeout = {};
        if (this.currentUserTypingTimeout) {
            clearTimeout(this.currentUserTypingTimeout);
            this.currentUserTypingTimeout = null;
        }
        this.isCurrentUserTyping = false;
        this.isTyping = {};
        /** Clear the current chat indicator */
        (window as any).currentOpenChatUserId = null;
    }

    private setupGlobalSocketListeners(): void {
        const socket = globalSocket.getSocket();
        if (!socket) return;

        socket.on('user_typing', (data: { user_id: string }) => {
            this.handleTypingStart(data.user_id);
        });

        socket.on('user_stopped_typing', (data: { user_id: string }) => {
            this.handleTypingStop(data.user_id);
        });

        socket.on('user_online', (data: { user_id: string }) => {
            this.onlineUsers.add(data.user_id);
            this.updateUserOnlineStatus(data.user_id, true);
        });

        socket.on('user_offline', (data: { user_id: string }) => {
            this.onlineUsers.delete(data.user_id);
            this.updateUserOnlineStatus(data.user_id, false);
        });

        socket.on('online_users_list', (data: { user_ids: string[] }) => {
            this.onlineUsers = new Set(data.user_ids.map(id => String(id)));
            setTimeout(() => {
                this.renderChats();
                this.renderFriends();
            }, 100);
        });

        socket.on('message_read', (data: { message_id: number }) => {
            /** Update the local message as read */
            const message = this.messages.find(m => m.id === data.message_id);
            if (message) {
                message.read_at = new Date().toISOString();
            }
        });

        socket.on('error', (data: { message: string }) => {
            showError(data.message);
        });

        /** Request online users when chat page loads */
        if (globalSocket.isConnected()) {
            socket.emit('get_online_users');
        }

        /** Listen for global messages */
        window.addEventListener('globalMessage', this.handleGlobalMessage.bind(this));
        window.addEventListener('openSpecificChat', this.handleOpenSpecificChat.bind(this));
        /** Listen for game events */
        window.addEventListener('game_invitation_response', this.handleGameInvitationResponse.bind(this) as EventListener);
        window.addEventListener('game_ready', this.handleGameReady.bind(this) as EventListener);
    }

    private handleGlobalMessage = (event: CustomEvent) => {
        const messageData = event.detail;
        /** If chat is open with this user, add message to UI */
        if (this.currentChatFriend && String(messageData.sender_id) === String(this.currentChatFriend.user_id)) {
            this.messages.push(messageData);
            this.renderMessages();
            this.scrollToBottom();
            /** Mark the new message as read since user is viewing the chat */
            this.markMessageAsRead(messageData.id);
        }
        /** Always update chats list */
        this.loadChats();
    };

    private handleOpenSpecificChat = (event: CustomEvent) => {
        const { userId } = event.detail;
        const friend = this.friends.find(f => String(f.user_id) === userId) || 
                      this.chats.find(c => String(c.friend.user_id) === userId)?.friend;
        
        if (friend) {
            this.openChat(friend);
        }
    };

    private handlePendingNavigation(): void {
        /** Check if we should open a specific chat (from notification click) */
        const pendingUserId = sessionStorage.getItem('openChatUserId');
        if (pendingUserId) {
            sessionStorage.removeItem('openChatUserId');
            setTimeout(async () => {
                await this.loadFriends();
                const friend = this.friends.find(f => String(f.user_id) === pendingUserId);
                if (friend) {
                    this.openChat(friend);
                }
            }, 500);
        }
    }

    private handleGameInvitationResponse = (event: Event) => {
        const customEvent = event as CustomEvent;
        // Game invitation response received
        const { invitation, responder, response } = customEvent.detail;
        
        // Processing invitation response
        
        /** Only handle if current user is the sender */
        if (String(invitation.sender_id) === String(this.currentUser?.id)) {
            // Current user is the sender
            if (response === 'accepted') {
                showNotification(`${responder.username} accepted your game invitation!`, 'success');
            } else if (response === 'declined') {
                showNotification(`${responder.username} declined your game invitation`, 'info');
            }
        } else {
            // Current user is not the sender
        }
    };

    private handleGameReady = (event: Event) => {
        const customEvent = event as CustomEvent;
        // Game ready event received
        const { game_session, room_id } = customEvent.detail;
        
        // Processing game ready event
        
        /** Check if current user is involved in this game */
        if (game_session && this.currentUser) {
            const currentUserId = String(this.currentUser.id);
            // Checking player IDs
            
            if (String(game_session.player1_id) === currentUserId || 
                String(game_session.player2_id) === currentUserId) {
                
                // Current user is involved in game
                // showNotification('Game is ready! Redirecting to match...', 'success');
                
                /** Navigate to the game */
                setTimeout(() => {
                    const navigationPath = `/game/remote/match/${game_session.id}?room=${room_id}`;
                    // Navigating to game
                    const event = new CustomEvent('navigate', {
                        detail: { path: navigationPath }
                    });
                    window.dispatchEvent(event);
                }, 1000);
            } else {
                // Current user is not involved in this game
            }
        } else {
            // Missing game_session or currentUser
        }
    };

	private updateUserOnlineStatus(userId: string, isOnline: boolean): void {
		const userIdStr = String(userId);
		/** Update ALL elements with this user ID (both in chats and friends) */
		const allUserElements = document.querySelectorAll(`[data-friend-id="${userIdStr}"]`);
		allUserElements.forEach((element) => {
			const statusIndicator = element.querySelector('.online-status');
			if (statusIndicator) {
				/** Determine the correct classes based on parent container */
				const isInFriendsList = element.closest('#friendsList') !== null;
				const baseClasses = isInFriendsList 
					? 'online-status absolute bottom-0 right-2 w-3 h-3 rounded-full border-2 border-gray-700'
					: 'online-status absolute -bottom-0 -right-0 w-3 h-3 rounded-full border-2 border-gray-800';
				
				statusIndicator.className = `${baseClasses} ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`;
			}
			/** Update status text if it exists (for friends list) */
			const statusText = element.querySelector('.status-text');
			if (statusText) {
				const friend = this.friends.find(f => String(f.user_id) === userIdStr);
				statusText.textContent = isOnline ? 'Online' : `Last seen ${formatDate(friend?.last_seen || friend?.created_at || '')}`;
			}
		});
		/** Update currently open chat status */
		if (this.currentChatFriend && String(this.currentChatFriend.user_id) === userIdStr) {
			const chatStatus = document.getElementById('chatStatus');
			if (chatStatus) {
				chatStatus.textContent = isOnline ? 'Online' : 'Offline';
				chatStatus.className = `text-sm ${isOnline ? 'text-green-400' : 'text-gray-400'}`;
			}
		}
	}

    private setupMessageInputListeners(): void {
        const messageInput = document.getElementById('messageInput') as HTMLInputElement;
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            messageInput.addEventListener('input', () => {
                this.handleTyping();
            });

            /** Stop typing when input loses focus */
            messageInput.addEventListener('blur', () => {
                this.stopTyping();
            });

            /** Stop typing when input is empty */
            messageInput.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                if (target.value.trim() === '') {
                    this.stopTyping();
                } else {
                    this.handleTyping();
                }
            });
        }
    }

    private setupEventListeners(): void {
        /** Tab switching */
        document.getElementById('chatsTab')?.addEventListener('click', () => this.switchTab('chats'));
        document.getElementById('friendsTab')?.addEventListener('click', () => this.switchTab('friends'));
        document.getElementById('requestsTab')?.addEventListener('click', () => this.switchTab('requests'));
        document.getElementById('blockedTab')?.addEventListener('click', () => this.switchTab('blocked'));
        /** Search */
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        searchInput?.addEventListener('input', this.debounce(() => this.handleSearch(searchInput.value), 300));
        this.setupMessageInputListeners();
        /** Send button */
        document.getElementById('sendBtn')?.addEventListener('click', () => this.sendMessage());
        /** Close chat */
        document.getElementById('closeChatBtn')?.addEventListener('click', () => this.closeChat());
        /** Block/Unblock buttons */
        document.getElementById('blockBtn')?.addEventListener('click', () => this.blockCurrentUser());
        document.getElementById('unblockBtn')?.addEventListener('click', () => this.unblockCurrentUser());
        /** Game invite button */
        document.getElementById('gameInviteBtn')?.addEventListener('click', () => this.showGameInviteModal());
        /** Profile view button */
        document.getElementById('viewProfileBtn')?.addEventListener('click', () => this.showProfileModal());
        /** Add friend modal */
        document.getElementById('addFriendBtn')?.addEventListener('click', () => this.showAddFriendModal());
        document.getElementById('cancelAddFriend')?.addEventListener('click', () => this.hideAddFriendModal());
        /** Friend search in modal */
        const friendSearchInput = document.getElementById('friendSearchInput') as HTMLInputElement;
        friendSearchInput?.addEventListener('input', this.debounce(() => this.searchUsersForFriend(friendSearchInput.value), 300));
        /** Game invite modal */
        document.getElementById('cancelGameInvite')?.addEventListener('click', () => this.hideGameInviteModal());
        document.getElementById('sendGameInvite')?.addEventListener('click', () => this.sendGameInvitation());
        /** Profile modal */
        document.getElementById('closeProfileModal')?.addEventListener('click', () => this.hideProfileModal());
        document.getElementById('closeProfileModalBtn')?.addEventListener('click', () => this.hideProfileModal());
        document.getElementById('profileGameInvite')?.addEventListener('click', () => this.profileToGameInvite());
    }

    private async loadInitialData(): Promise<void> {
        try {
            await Promise.all([
                this.loadChats(),
                this.loadFriends(),
                this.loadFriendRequests(),
                this.loadBlockedUsers()
            ]);
        } catch (error) {
            // Failed to load initial data
            showError('Failed to load chat data');
        }
    }

    private async loadChats(): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('/api/chat/chats/recent', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load chats');
            this.chats = await response.json();
            this.renderChats();
            this.updateUnreadBadge();
        } catch (error) {
            // Failed to load chats
        }
    }

    private async loadFriends(): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('/api/chat/friends/details', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load friends');
            this.friends = await response.json();
            this.renderFriends();
        } catch (error) {
            // Failed to load friends
        }
    }

    private async loadFriendRequests(): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('/api/chat/friends/requests/details', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load friend requests');
            this.friendRequests = await response.json();
            this.renderFriendRequests();
            this.updateRequestsBadge();
        } catch (error) {
            // Failed to load friend requests
        }
    }

    private switchTab(tab: 'chats' | 'friends' | 'requests' | 'blocked'): void {
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
        document.getElementById('blockedList')?.classList.add('hidden');
        document.getElementById(`${tab}List`)?.classList.remove('hidden');
    }

	private isUserOnline(userId: string): boolean {
		const userIdStr = String(userId);
		const isOnline = this.onlineUsers.has(userIdStr);
		return isOnline;
	}

	private renderChats(): void {
		const container = document.getElementById('chatsList');
		if (!container) return;
		
		/** Filter out chats with blocked users */
		const visibleChats = this.chats.filter(chat => 
			!this.blockedUsers.some(blocked => String(blocked.user_id) === String(chat.friend.user_id))
		);
		
		if (visibleChats.length === 0) {
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
		container.innerHTML = visibleChats.map(chat => {
			const userIdStr = String(chat.friend.user_id);
			const isOnline = this.isUserOnline(userIdStr);
			return `
				<div class="chat-item p-3 rounded-lg bg-gray-700 hover:bg-gray-600 cursor-pointer transition-colors" 
					data-friend-id="${userIdStr}">
					<div class="flex items-center">
						<div class="relative mr-3">
							<img class="w-12 h-12 rounded-full" 
								src="${chat.friend.photo?.path ? `${API_CONFIG.GATEWAY_URL}${chat.friend.photo.path}` : generateAvatarUrl()}"
								alt="${chat.friend.display_name}">
							<!-- Online status indicator -->
							<div class="online-status absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-700 ${
								isOnline ? 'bg-green-500' : 'bg-gray-500'
							}"></div>
						</div>
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
			`;
		}).join('');
		container.querySelectorAll('.chat-item').forEach(item => {
			item.addEventListener('click', () => {
				const friendId = item.getAttribute('data-friend-id');
				const friend = this.chats.find(c => String(c.friend.user_id) === friendId)?.friend;
				if (friend) this.openChat(friend);
			});
		});
	}

	private renderFriends(): void {
		const container = document.getElementById('friendsList');
		if (!container) return;
		
		/** Filter out blocked users from friends list */
		const visibleFriends = this.friends.filter(friend => 
			!this.blockedUsers.some(blocked => String(blocked.user_id) === String(friend.user_id))
		);
		
		if (visibleFriends.length === 0) {
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
		container.innerHTML = visibleFriends.map(friend => {
			const userIdStr = String(friend.user_id);
			const isOnline = this.isUserOnline(userIdStr);
			return `
				<div class="friend-item p-3 rounded-lg bg-gray-700 hover:bg-gray-600 cursor-pointer transition-colors" 
					data-friend-id="${userIdStr}">
					<div class="flex items-center">
						<div class="relative mr-3">
							<img class="w-12 h-12 rounded-full" 
								src="${friend.photo?.path ? `${API_CONFIG.GATEWAY_URL}${friend.photo.path}` : generateAvatarUrl()}" 
								alt="${friend.display_name}">
							<div class="online-status absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-700 ${
								isOnline ? 'bg-green-500' : 'bg-gray-500'
							}"></div>
						</div>
						<div class="flex-1">
							<p class="font-medium text-white">${escapeHtml(friend.display_name)}</p>
							<p class="status-text text-sm text-gray-400">
								${isOnline ? 'Online' : `Last seen ${formatDate(friend.last_seen || friend.created_at)}`}
							</p>
						</div>
					</div>
				</div>
			`;
		}).join('');
		container.querySelectorAll('.friend-item').forEach(item => {
			item.addEventListener('click', () => {
				const friendId = item.getAttribute('data-friend-id');
				const friend = this.friends.find(f => String(f.user_id) === friendId);
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
						src="${request.photo?.path ? `${API_CONFIG.GATEWAY_URL}${request.photo.path}` : generateAvatarUrl()}"
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
        // Opening chat with friend
        this.stopTyping();
        this.isTyping = {};
        this.currentChatFriend = friend;
        // Current chat friend set
        this.messages = [];
        /** Set global indicator so notifications know which chat is open */
        (window as any).currentOpenChatUserId = friend.user_id;
        document.getElementById('welcomeScreen')?.classList.add('hidden');
        document.getElementById('chatHeader')?.classList.remove('hidden');
        document.getElementById('messagesArea')?.classList.remove('hidden');
        const chatAvatar = document.getElementById('chatAvatar') as HTMLImageElement;
        const chatName = document.getElementById('chatName');
        const chatStatus = document.getElementById('chatStatus');
        if (chatAvatar) chatAvatar.src = (friend.photo?.path ? API_CONFIG.GATEWAY_URL + friend.photo.path : generateAvatarUrl());
        if (chatName) chatName.textContent = friend.display_name;
        const isOnline = this.isUserOnline(friend.user_id);
        if (chatStatus) {
            chatStatus.textContent = isOnline ? 'Online' : 'Offline';
            chatStatus.className = `text-sm ${isOnline ? 'text-green-400': 'text-gray-400'}`;
        }
        /** Update block/unblock button visibility immediately */
        await this.updateBlockButtons();
        await this.loadMessages(friend.user_id);
        this.scrollToBottom();
    }

    private closeChat(): void {
        // Closing chat
        this.stopTyping();
        this.isTyping = {};
        this.currentChatFriend = null;
        this.messages = [];
        /** Clear global indicator */
        (window as any).currentOpenChatUserId = null;
        /** Hide game invite and profile buttons */
        const gameInviteBtn = document.getElementById('gameInviteBtn');
        const viewProfileBtn = document.getElementById('viewProfileBtn');
        if (gameInviteBtn) {
            gameInviteBtn.classList.add('hidden');
        }
        if (viewProfileBtn) {
            viewProfileBtn.classList.add('hidden');
        }
        document.getElementById('welcomeScreen')?.classList.remove('hidden');
        document.getElementById('chatHeader')?.classList.add('hidden');
        document.getElementById('messagesArea')?.classList.add('hidden');
    }


    private async loadMessages(friendId: string): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch(`/api/chat/messages/${friendId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load messages');
            this.messages = await response.json();
            this.renderMessages();
            /** Mark unread messages as read */
            await this.markUnreadMessagesAsRead();
        } catch (error) {
            // Failed to load messages
            showError('Failed to load messages');
        }
    }

    private renderMessages(): void {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        container.innerHTML = this.messages.map(message => {
            const isOwn = String(message.sender_id) === String(this.currentUser.id);
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
        if (!content || !this.currentChatFriend) return;
        
        /** Check if current user blocked this user */
        const isBlocked = await this.isUserBlocked(this.currentChatFriend.user_id);
        if (isBlocked) {
            showError('Cannot send message to blocked user');
            input.value = '';
            return;
        }
        
        input.value = '';
        globalSocket.sendMessage(this.currentChatFriend.user_id, content, 'text');

        const tempMessage: Message = {
            id: Date.now(),
            sender_id: this.currentUser.id,
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


    private handleTyping(): void {
        if (!this.currentChatFriend) return;

        if (!this.isCurrentUserTyping) {
            this.isCurrentUserTyping = true;
            globalSocket.startTyping(this.currentChatFriend.user_id);
        }

        if (this.currentUserTypingTimeout) {
            clearTimeout(this.currentUserTypingTimeout);
        }

        this.currentUserTypingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 2000);
    }

    private stopTyping(): void {
        if (!this.currentChatFriend || !this.isCurrentUserTyping) return;

        globalSocket.stopTyping(this.currentChatFriend.user_id);
        this.isCurrentUserTyping = false;
        
        if (this.currentUserTypingTimeout) {
            clearTimeout(this.currentUserTypingTimeout);
            this.currentUserTypingTimeout = null;
        }
    }

    private handleTypingStart(userId: string): void {
        if (this.currentChatFriend && String(userId) === String(this.currentChatFriend.user_id)) {
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
            const response = await fetch(`/api/chat/users/search?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Search failed');
            const users = await response.json();
            if (users.length === 0) {
                resultsContainer.innerHTML = '<p class="text-gray-400 text-sm p-2">No users found</p>';
            } else {
                resultsContainer.innerHTML = users.map((user: User) => `
                    <div class="search-result p-2 rounded bg-gray-600 hover:bg-gray-500 transition-colors" 
                         data-user-id="${user.user_id}">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center flex-1 cursor-pointer">
                                <img class="w-8 h-8 rounded-full mr-2"
                                     src="${user.photo?.path ? `${API_CONFIG.GATEWAY_URL}${user.photo.path}` : generateAvatarUrl()}"
                                     alt="${user.display_name}">
                                <div>
                                    <p class="text-white text-sm font-medium">${escapeHtml(user.display_name)}</p>
                                    <p class="text-gray-400 text-xs">@${escapeHtml(user.username)}</p>
                                </div>
                            </div>
                            <button class="block-user-search text-red-400 hover:text-red-300 p-1 ml-2" 
                                    data-user-id="${user.user_id}" title="Block User">
                                <img class="w-4 h-4 filter brightness-0 invert opacity-70 hover:opacity-100" src="/block-user.svg" alt="Block">
                            </button>
                        </div>
                    </div>
                `).join('');
                resultsContainer.querySelectorAll('.search-result').forEach(item => {
                    const clickableArea = item.querySelector('.flex.items-center.flex-1.cursor-pointer');
                    clickableArea?.addEventListener('click', async () => {
                        const userId = item.getAttribute('data-user-id');
                        if (userId) await this.sendFriendRequest(userId);
                    });
                });
                
                resultsContainer.querySelectorAll('.block-user-search').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const userId = btn.getAttribute('data-user-id');
                        if (userId) {
                            await this.blockUser(userId);
                            /** Remove from search results */
                            document.getElementById('searchResults')?.classList.add('hidden');
                            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
                            if (searchInput) searchInput.value = '';
                        }
                    });
                });
            }
            resultsContainer.classList.remove('hidden');
        } catch (error) {
            // Search failed
            resultsContainer.innerHTML = '<p class="text-red-400 text-sm p-2">Search failed</p>';
            resultsContainer.classList.remove('hidden');
        }
    }

    private async sendFriendRequest(userId: string): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('/api/chat/friends/request', {
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
            // Failed to send friend request
            showError(error instanceof Error ? error.message : 'Failed to send friend request');
        }
    }

    private async acceptFriendRequest(userId: string): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('/api/chat/friends/accept', {
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
            // Failed to accept friend request
            showError('Failed to accept friend request');
        }
    }

    private async declineFriendRequest(userId: string): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('/api/chat/friends/decline', {
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
            // Failed to decline friend request
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
            const response = await fetch(`/api/chat/users/search?q=${encodeURIComponent(query)}`, {
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
								src="${user.photo?.path ? `${API_CONFIG.GATEWAY_URL}${user.photo.path}` : generateAvatarUrl()}"
                                alt="${user.display_name}">
                            <div>
                                <p class="text-white font-medium">${escapeHtml(user.display_name)}</p>
                                <p class="text-gray-400 text-sm">@${escapeHtml(user.username)}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button class="send-request bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors" 
                                    data-user-id="${user.user_id}">
                                Add Friend
                            </button>
                            <button class="block-user-modal text-red-400 hover:text-red-300 p-1" 
                                    data-user-id="${user.user_id}" title="Block User">
                                <img class="w-4 h-4 filter brightness-0 invert opacity-70 hover:opacity-100" src="/block-user.svg" alt="Block">
                            </button>
                        </div>
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
                
                resultsContainer.querySelectorAll('.block-user-modal').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const userId = btn.getAttribute('data-user-id');
                        if (userId) {
                            await this.blockUser(userId);
                            this.hideAddFriendModal();
                        }
                    });
                });
            }
        } catch (error) {
            // Search failed
            resultsContainer.innerHTML = '<p class="text-red-400 text-sm p-2">Search failed</p>';
        }
    }

    private updateUnreadBadge(): void {
        const badge = document.getElementById('unreadBadge');
        if (!badge) return;
        
        /** Only count unread messages from non-blocked users */
        const visibleChats = this.chats.filter(chat => 
            !this.blockedUsers.some(blocked => String(blocked.user_id) === String(chat.friend.user_id))
        );
        const totalUnread = visibleChats.reduce((sum, chat) => sum + chat.unread_count, 0);
        
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

    private async loadBlockedUsers(): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('/api/chat/users/blocked', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load blocked users');
            const blockedIds = await response.json();
            
            /** Get profiles for blocked users */
            const blockedUserProfiles = await Promise.all(
                blockedIds.map(async (blocked: any) => {
                    try {
                        const profileResponse = await fetch(`/api/user/profile/${blocked.blocked_id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (profileResponse.ok) {
                            const profile = await profileResponse.json();
                            return {
                                ...profile,
                                blocked_date: new Date().toISOString() /** Default date */
                            };
                        }
                    } catch (error) {
                        // Failed to load blocked user profile
                    }
                    return null;
                })
            );
            
            this.blockedUsers = blockedUserProfiles.filter(profile => profile !== null) as BlockedUser[];
            this.renderBlockedUsers();
            this.updateBlockedBadge();
        } catch (error) {
            // Failed to load blocked users
        }
    }

    private renderBlockedUsers(): void {
        const container = document.getElementById('blockedList');
        if (!container) return;
        
        if (this.blockedUsers.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636a9 9 0 00-12.728 0M5.636 18.364a9 9 0 0012.728 0"></path>
                    </svg>
                    <p>No blocked users</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.blockedUsers.map(user => `
            <div class="p-3 rounded-lg bg-gray-700">
                <div class="flex items-center mb-3">
                    <img class="w-10 h-10 rounded-full mr-3"
                        src="${user.photo?.path ? `${API_CONFIG.GATEWAY_URL}${user.photo.path}` : generateAvatarUrl()}"
                        alt="${user.display_name}">
                    <div class="flex-1">
                        <p class="font-medium text-white">${escapeHtml(user.display_name)}</p>
                        <p class="text-xs text-gray-400">@${escapeHtml(user.username)}</p>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button class="unblock-user flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded transition-colors" 
                            data-user-id="${user.user_id}">
                        Unblock
                    </button>
                </div>
            </div>
        `).join('');
        
        /** Add click listeners for unblock */
        container.querySelectorAll('.unblock-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.getAttribute('data-user-id');
                if (userId) await this.unblockUser(userId);
            });
        });
    }

    private updateBlockedBadge(): void {
        const badge = document.getElementById('blockedBadge');
        if (!badge) return;
        if (this.blockedUsers.length > 0) {
            badge.textContent = this.blockedUsers.length.toString();
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    private async blockUser(userId: string): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('/api/chat/users/block', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ target_user_id: userId })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to block user');
            }
            
            /** Get the user's display name for the notification */
            const blockedUser = this.friends.find(friend => String(friend.user_id) === String(userId)) ||
                               this.chats.find(chat => String(chat.friend.user_id) === String(userId))?.friend;
            const displayName = blockedUser?.display_name || 'User';
            
            showNotification(`${displayName} has been blocked`, 'success');
            
            /** Close chat if it's open with this user */
            if (this.currentChatFriend && String(this.currentChatFriend.user_id) === String(userId)) {
                this.closeChat();
            }
            
            /** Reload blocked users and re-render UI */
            await this.loadBlockedUsers();
            this.renderChats(); // Re-render to filter out blocked user
            this.renderFriends(); // Re-render friends list
        } catch (error) {
            // Failed to block user
            showError(error instanceof Error ? error.message : 'Failed to block user');
        }
    }

    private async unblockUser(userId: string): Promise<void> {
        try {
            const token = getStoredToken();
            const response = await fetch('/api/chat/users/unblock', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ target_user_id: userId })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to unblock user');
            }
            
            showNotification('User unblocked successfully', 'success');
            
            /** Reload all data to restore chat history and update UI */
            await Promise.all([
                this.loadBlockedUsers(),
                this.loadChats(), // This will restore the chat history
                this.loadFriends() // This will restore them to friends if they were friends
            ]);
            
            /** If currently chatting with this user, update the block buttons */
            if (this.currentChatFriend && String(this.currentChatFriend.user_id) === String(userId)) {
                await this.updateBlockButtons();
            }
        } catch (error) {
            // Failed to unblock user
            showError(error instanceof Error ? error.message : 'Failed to unblock user');
        }
    }

    private async blockCurrentUser(): Promise<void> {
        if (!this.currentChatFriend) return;
        await this.blockUser(this.currentChatFriend.user_id);
    }

    private async unblockCurrentUser(): Promise<void> {
        if (!this.currentChatFriend) return;
        await this.unblockUser(this.currentChatFriend.user_id);
    }

    private async isUserBlocked(userId: string): Promise<boolean> {
        return this.blockedUsers.some(blockedUser => String(blockedUser.user_id) === String(userId));
    }

    private async isCurrentUserBlockedBy(userId: string): Promise<boolean> {
        try {
            const token = getStoredToken();
            const response = await fetch(`/api/chat/users/is-blocked-by`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId })
            });
            if (response.ok) {
                const result = await response.json();
                return result.is_blocked;
            }
        } catch (error) {
            // Failed to check if blocked by user
        }
        return false;
    }

    private async updateBlockButtons(): Promise<void> {
        const blockBtn = document.getElementById('blockBtn');
        const unblockBtn = document.getElementById('unblockBtn');
        const gameInviteBtn = document.getElementById('gameInviteBtn');
        const viewProfileBtn = document.getElementById('viewProfileBtn');
        const messageInput = document.getElementById('messageInput') as HTMLInputElement;
        const sendBtn = document.getElementById('sendBtn');
        
        if (!blockBtn || !unblockBtn || !this.currentChatFriend) return;
        
        const isBlocked = await this.isUserBlocked(this.currentChatFriend.user_id);
        const isBlockedByUser = await this.isCurrentUserBlockedBy(this.currentChatFriend.user_id);
        
        if (isBlocked) {
            /** Current user has blocked this user */
            blockBtn.classList.add('hidden');
            unblockBtn.classList.remove('hidden');
            
            /** Hide game invite and profile buttons for blocked users */
            if (gameInviteBtn) {
                gameInviteBtn.classList.add('hidden');
            }
            if (viewProfileBtn) {
                viewProfileBtn.classList.add('hidden');
            }
            
            /** Disable messaging for blocked users */
            if (messageInput) {
                messageInput.disabled = true;
                messageInput.placeholder = 'Cannot send messages to blocked user';
                messageInput.classList.add('opacity-50', 'cursor-not-allowed');
            }
            if (sendBtn) {
                sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
                (sendBtn as HTMLButtonElement).disabled = true;
            }
        } else if (isBlockedByUser) {
            /** Current user has been blocked by this user */
            blockBtn.classList.remove('hidden');
            unblockBtn.classList.add('hidden');
            
            /** Hide game invite button when blocked by user, but keep profile button */
            if (gameInviteBtn) {
                gameInviteBtn.classList.add('hidden');
            }
            if (viewProfileBtn) {
                viewProfileBtn.classList.remove('hidden');
            }
            
            /** Disable messaging - user is blocked by the other person */
            if (messageInput) {
                messageInput.disabled = true;
                messageInput.placeholder = `You cannot send messages because you are blocked by ${this.currentChatFriend.display_name}`;
                messageInput.classList.add('opacity-50', 'cursor-not-allowed');
            }
            if (sendBtn) {
                sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
                (sendBtn as HTMLButtonElement).disabled = true;
            }
            
            /** Show a status message in the chat header */
            const chatStatus = document.getElementById('chatStatus');
            if (chatStatus) {
                chatStatus.textContent = `You have been blocked by ${this.currentChatFriend.display_name}`;
                chatStatus.className = 'text-sm text-red-400';
            }
        } else {
            /** Normal state - no blocking */
            blockBtn.classList.remove('hidden');
            unblockBtn.classList.add('hidden');
            
            /** Show game invite and profile buttons for non-blocked users */
            if (gameInviteBtn) {
                gameInviteBtn.classList.remove('hidden');
            }
            if (viewProfileBtn) {
                viewProfileBtn.classList.remove('hidden');
            }
            
            /** Enable messaging for non-blocked users */
            if (messageInput) {
                messageInput.disabled = false;
                messageInput.placeholder = 'Type a message...';
                messageInput.classList.remove('opacity-50', 'cursor-not-allowed');
            }
            if (sendBtn) {
                sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                (sendBtn as HTMLButtonElement).disabled = false;
            }
            
            /** Restore normal chat status */
            const chatStatus = document.getElementById('chatStatus');
            if (chatStatus) {
                const isOnline = this.isUserOnline(this.currentChatFriend.user_id);
                chatStatus.textContent = isOnline ? 'Online' : 'Offline';
                chatStatus.className = `text-sm ${isOnline ? 'text-green-400' : 'text-gray-400'}`;
            }
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

    private async markUnreadMessagesAsRead(): Promise<void> {
        if (!this.currentChatFriend) return;
        
        /** Find all unread messages from the current friend */
        const unreadMessages = this.messages.filter(message => 
            !message.read_at && 
            String(message.sender_id) === String(this.currentChatFriend!.user_id)
        );
        
        if (unreadMessages.length === 0) return;
        
        try {
            /** Use the new API endpoint to mark entire conversation as read */
            const token = getStoredToken();
            const response = await fetch(`/api/chat/messages/${this.currentChatFriend.user_id}/mark-read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.ok) {
                /** Update local messages to mark them as read */
                unreadMessages.forEach(message => {
                    message.read_at = new Date().toISOString();
                });
                
                /** Refresh chats list to update unread counts */
                this.loadChats();
            }
        } catch (error) {
            console.error('Failed to mark conversation as read:', error);
            /** Fallback to marking individual messages */
            for (const message of unreadMessages) {
                await this.markMessageAsRead(message.id);
            }
            this.loadChats();
        }
    }

    private async markMessageAsRead(messageId: number): Promise<void> {
        try {
            const socket = globalSocket.getSocket();
            if (socket && socket.connected) {
                socket.emit('mark_read', { message_id: messageId });
            }
        } catch (error) {
            console.error('Failed to mark message as read:', error);
        }
    }

    private debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
        let timeoutId: ReturnType<typeof setTimeout>;
        return (...args: Parameters<T>) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    private showGameInviteModal(): void {
        // Fallback: try to get current chat friend from global state
        let currentFriend: User | null = this.currentChatFriend;
        if (!currentFriend) {
            const currentUserId = (window as any).currentOpenChatUserId;
            if (currentUserId) {
                const foundFriend = this.friends.find(f => String(f.user_id) === String(currentUserId));
                currentFriend = foundFriend || null;
            }
        }
        
        if (!currentFriend) {
            showError('No friend selected for game invite');
            return;
        }
        
        // Use the found friend (either currentChatFriend or fallback)
        const friendToUse = currentFriend;

        const modal = document.getElementById('gameInviteModal');
        const avatar = document.getElementById('inviteUserAvatar') as HTMLImageElement;
        const name = document.getElementById('inviteUserName');
        const message = document.getElementById('gameInviteMessage') as HTMLTextAreaElement;

        if (modal && avatar && name && message) {
            avatar.src = friendToUse.photo?.path ? 
                `${API_CONFIG.GATEWAY_URL}${friendToUse.photo.path}` : 
                generateAvatarUrl();
            name.textContent = friendToUse.display_name;
            message.value = `${friendToUse.display_name}, let's play Pong! 🏓`;
            modal.classList.remove('hidden');
        }
    }

    private hideGameInviteModal(): void {
        const modal = document.getElementById('gameInviteModal');
        const message = document.getElementById('gameInviteMessage') as HTMLTextAreaElement;
        
        if (modal) {
            modal.classList.add('hidden');
        }
        if (message) {
            message.value = '';
        }
    }

    private async sendGameInvitation(): Promise<void> {
        let currentFriend: User | null = this.currentChatFriend;
        if (!currentFriend) {
            const currentUserId = (window as any).currentOpenChatUserId;
            if (currentUserId) {
                const foundFriend = this.friends.find(f => String(f.user_id) === String(currentUserId));
                currentFriend = foundFriend || null;
            }
        }
        
        if (!currentFriend) {
            console.error('🎮 ERROR: No friend selected for game invite (no fallback available)');
            showError('No friend selected for game invite');
            return;
        }
        
        // Use the found friend (either currentChatFriend or fallback)
        const friendToUse = currentFriend;

        const messageInput = document.getElementById('gameInviteMessage') as HTMLTextAreaElement;
        const customMessage = messageInput?.value.trim();
        
        const sendButton = document.getElementById('sendGameInvite') as HTMLButtonElement;
        if (sendButton) {
            sendButton.disabled = true;
            sendButton.innerHTML = `
                <svg class="w-4 h-4 inline mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Sending...
            `;
        }

        try {
            const token = getStoredToken();
            const response = await fetch('/api/game/invite', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    receiver_id: friendToUse.user_id,
                    game_mode: 'remote',
                    message: customMessage || `${this.currentUser?.display_name || 'Someone'} invites you to play Pong!`
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send game invitation');
            }

            await response.json();
            showNotification(`Game invitation sent to ${friendToUse.display_name}! You'll be notified when they respond.`, 'success');
            this.hideGameInviteModal();

        } catch (error) {
            console.error('Failed to send game invitation:', error);
            showError(error instanceof Error ? error.message : 'Failed to send game invitation');
        } finally {
            if (sendButton) {
                sendButton.disabled = false;
                sendButton.innerHTML = `
                    <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                    </svg>
                    Send Challenge
                `;
            }
        }
    }

    private async showProfileModal(): Promise<void> {
        let currentFriend: User | null = this.currentChatFriend;
        if (!currentFriend) {
            const currentUserId = (window as any).currentOpenChatUserId;
            if (currentUserId) {
                const foundFriend = this.friends.find(f => String(f.user_id) === String(currentUserId));
                currentFriend = foundFriend || null;
            }
        }
        
        if (!currentFriend) {
            console.error('👤 ERROR: No friend selected for profile view');
            showError('No friend selected to view profile');
            return;
        }

        try {
            // Fetch detailed profile information
            const token = getStoredToken();
            const response = await fetch(`/api/user/profile/${currentFriend.user_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch profile');
            }

            const profileData = await response.json();

            // Populate modal with profile information
            this.populateProfileModal(currentFriend, profileData);
            
            // Show the modal
            const modal = document.getElementById('profileModal');
            if (modal) {
                modal.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Failed to fetch profile:', error);
            showError('Failed to load profile information');
        }
    }

    private populateProfileModal(friend: User, profileData: any): void {
        // Profile avatar
        const avatar = document.getElementById('profileUserAvatar') as HTMLImageElement;
        if (avatar) {
            avatar.src = friend.photo?.path ? 
                `${API_CONFIG.GATEWAY_URL}${friend.photo.path}` : 
                generateAvatarUrl();
        }

        // Profile name and username
        const nameElement = document.getElementById('profileUserName');
        const usernameElement = document.getElementById('profileUsername');
        if (nameElement) nameElement.textContent = friend.display_name || friend.username;
        if (usernameElement) usernameElement.textContent = `@${profileData.username || friend.username}`;

        // Online status
        const statusElement = document.getElementById('profileUserStatus');
        const statusTextElement = document.getElementById('profileUserStatusText');
        const isOnline = this.onlineUsers.has(String(friend.user_id));
        
        if (statusElement && statusTextElement) {
            if (isOnline) {
                statusElement.classList.remove('hidden');
                statusElement.className = 'absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-gray-800 rounded-full';
                statusTextElement.textContent = 'Online';
            } else {
                statusElement.classList.add('hidden');
                statusTextElement.textContent = 'Offline';
            }
        }

        // Bio
        const bioElement = document.getElementById('profileUserBio');
        if (bioElement) {
            bioElement.textContent = profileData.bio || 'No bio available';
        }

        // Member since
        const memberSinceElement = document.getElementById('profileMemberSince');
        if (memberSinceElement && profileData.created_at) {
            const createdDate = new Date(profileData.created_at);
            memberSinceElement.textContent = createdDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Friendship info
        const friendshipInfoDiv = document.getElementById('friendshipInfo');
        const friendshipDateElement = document.getElementById('profileFriendshipDate');
        if (friendshipInfoDiv && friendshipDateElement && (friend as any).friendship_date) {
            const friendshipDate = new Date((friend as any).friendship_date);
            friendshipDateElement.textContent = friendshipDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            friendshipInfoDiv.style.display = 'block';
        } else if (friendshipInfoDiv) {
            friendshipInfoDiv.style.display = 'none';
        }
    }

    private hideProfileModal(): void {
        const modal = document.getElementById('profileModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    private profileToGameInvite(): void {
        // Hide profile modal and show game invite modal
        this.hideProfileModal();
        setTimeout(() => {
            this.showGameInviteModal();
        }, 100); // Small delay for smooth transition
    }
}