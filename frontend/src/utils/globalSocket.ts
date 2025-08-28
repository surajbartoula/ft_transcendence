import { io, Socket } from 'socket.io-client';
import { getStoredToken, getStoredUser } from './auth';
import { showClickableNotification } from './ui';

interface Message {
    id: number;
    sender_id: string;
    receiver_id: string;
    content: string;
    message_type: string;
    created_at: string;
    sender_profile?: User;
}

interface User {
    user_id: string;
    username: string;
    display_name: string;
    photo?: PhotoInfo | null;
}

interface PhotoInfo {
    filename: string;
    path: string;
    uploaded_at: string;
}

class GlobalSocket {
    private socket: Socket | null = null;
    private currentUser: any = null;
    private isConnecting = false;
    private lastDisconnectTime = 0;
    private connectionCooldown = 500; // Minimum time between connections

    constructor() {
        this.currentUser = getStoredUser();
        if (this.currentUser) {
            this.connect();
        }
    }

    connect(): void {
        // Update current user data
        this.currentUser = getStoredUser();
        const token = getStoredToken();
        
        if (!token || !this.currentUser) {
            console.warn('❌ GlobalSocket: No token or user data available for connection');
            return;
        }
        
        // Check if already connected or connecting
        if (this.socket?.connected || this.isConnecting) {
            console.log('✅ GlobalSocket: Already connected or connecting, skipping');
            return;
        }
        
        // Respect connection cooldown period
        const timeSinceLastDisconnect = Date.now() - this.lastDisconnectTime;
        if (timeSinceLastDisconnect < this.connectionCooldown) {
            console.log(`⏳ GlobalSocket: Connection cooldown active (${this.connectionCooldown - timeSinceLastDisconnect}ms remaining)`);
            setTimeout(() => this.connect(), this.connectionCooldown - timeSinceLastDisconnect);
            return;
        }
        
        // Set connecting state
        this.isConnecting = true;
        
        // Clean up any existing socket before creating new one
        if (this.socket) {
            console.log('🧹 GlobalSocket: Cleaning up existing socket');
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket.close();
            this.socket = null;
        }

        // Connect to chat service through gateway proxy
        this.socket = io('/', {
            path: '/chat-socket/socket.io',
            auth: { token },
            timeout: 10000,
            withCredentials: true,
            forceNew: true, // Always create a new connection
            transports: ['websocket', 'polling']
        });

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        if (!this.socket) return;
        this.socket.on('connect', () => {
            console.log('Global socket connected');
            this.isConnecting = false;
            
            // Authenticate with chat service
            if (this.currentUser) {
                const authData = {
                    user_id: this.currentUser.id,
                    username: this.currentUser.name // Use consistent field name
                };
                console.log('🔑 GlobalSocket: Sending authentication data:', authData);
                this.socket?.emit('authenticate', authData);
            }
            
            /** Send heartbeat every 30 seconds to stay online */
            setInterval(() => {
                this.socket?.emit('heartbeat');
            }, 30000);
        });
        this.socket.on('disconnect', () => {
            console.log('Global socket disconnected');
        });
        /** Handle incoming messages */
        this.socket.on('new_message', (data: Message & { sender_profile: User }) => {
            this.handleNewMessage(data);
        });
        /** Handle friend requests */
        this.socket.on('friend_request', (data: { from_user: User; message: string }) => {
            showClickableNotification(
                data.message, 
                'info', 
                0, /** Don't auto-dismiss */
                () => this.navigateToChat() /** Click to go to chat */
            );
        });
        this.socket.on('friend_request_accepted', (data: { from_user: User; message: string }) => {
            showClickableNotification(data.message, 'success');
        });
        
        // Authentication response handlers
        this.socket.on('authenticated', (data) => {
            console.log('✅ GlobalSocket: Authentication successful!', data);
        });

        this.socket.on('auth_error', (data) => {
            console.error('❌ GlobalSocket: Authentication failed!', data);
        });
    }

    private handleNewMessage(data: Message & { sender_profile: User }): void {
        /** Only show notification if not currently on chat page or chat is not open with this user */
        const isOnChatPage = window.location.pathname === '/chat';
        const currentChatUserId = this.getCurrentOpenChatUserId();
        const isCurrentChat = String(currentChatUserId) === String(data.sender_id);

        /** Show notification if not on chat page OR not chatting with this specific user */
        if (!isOnChatPage || !isCurrentChat) {
            showClickableNotification(
                `${data.sender_profile.display_name}: ${data.content}`,
                'info',
                0, // Don't auto-dismiss
                () => this.navigateToChat(data.sender_id) // Click to open chat with sender
            );
        }
        /** If currently on chat page, let the ChatPage handle the message */
        if (isOnChatPage) {
            window.dispatchEvent(new CustomEvent('globalMessage', { detail: data }));
        }
    }

    private getCurrentOpenChatUserId(): string | null {
        /** Set by ChatPage when a chat is opened */
        return (window as any).currentOpenChatUserId || null;
    }

    private navigateToChat(userId?: string): void {
        if (window.location.pathname !== '/chat') {
            if (userId) {
                sessionStorage.setItem('openChatUserId', userId);
            }
            /** Navigate to chat page */
            window.history.pushState({}, '', '/chat');
            window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
            /** Already on chat page, just open the specific chat */
            if (userId) {
                window.dispatchEvent(new CustomEvent('openSpecificChat', { 
                    detail: { userId } 
                }));
            }
        }
    }

    disconnect(): void {
        if (this.socket) {
            // Force close the socket completely to prevent reuse of old session
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket.close();
            this.socket = null;
        }
        this.isConnecting = false;
        this.lastDisconnectTime = Date.now();
        // Clear current user data to prevent stale authentication
        this.currentUser = null;
    }

    /** Method for ChatPage to use the same socket */
    getSocket(): Socket | null {
        return this.socket;
    }

    isConnected(): boolean {
        return this.socket?.connected === true;
    }

    /** Method to send messages (for ChatPage to use) */
    sendMessage(receiverId: string, content: string, messageType: string = 'text'): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('send_message', {
                receiver_id: receiverId,
                content,
                message_type: messageType
            });
        }
    }

    startTyping(receiverId: string): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('typing_start', { receiver_id: receiverId });
        }
    }

    stopTyping(receiverId: string): void {
        if (this.socket && this.isConnected()) {
            this.socket.emit('typing_stop', { receiver_id: receiverId });
        }
    }
}

/** Creating singleton instance */
const globalSocket = new GlobalSocket();

export default globalSocket;