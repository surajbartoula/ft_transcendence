import { Router } from './router/Router';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatPage } from './pages/ChatPage';
import { GamePage } from './pages/GamePage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { getCurrentUser, User, getStoredUser } from './utils/auth';
import { showNotification, showError } from './utils/ui';
import globalSocket from './utils/globalSocket';

declare global {
	interface WindowEventMap {
		authSuccess: CustomEvent<{ token: string; user?: User }>;
		logout: CustomEvent;
		navigate: CustomEvent<{ path: string }>;
		navigateToVerification: CustomEvent<{ email?: string }>;
		navigateToLogin: CustomEvent;
		userLoggedIn: CustomEvent;
		userLoggedOut: CustomEvent;
	}
}

class App {
	private router = new Router();
	private currentUser: User | null = null;
	private token = localStorage.getItem('token');

	constructor() {
		this.setupRoutes();
		this.bindEvents();
		this.initializeApp();
	}

	private setupRoutes(): void {
		const routes = [
			{ path: '/', page: () => new LoginPage(), requiresAuth: false },
			{ path: '/login', page: () => new LoginPage(), requiresAuth: false },
			{ path: '/verify-email', page: () => new EmailVerificationPage(), requiresAuth: false},
			{ path: '/dashboard', page: () => new DashboardPage(), requiresAuth: true },
			{ path: '/dashboard/profile', page: () => new ProfilePage(), requiresAuth: true },
			{ path: '/dashboard/leaderboard', page: () => new LeaderboardPage(), requiresAuth: true },
			{ path: '/dashboard/settings', page: () => new SettingsPage(), requiresAuth: true },
			{ path: '/chat', page: () => new ChatPage(), requiresAuth: true },
			{ path: '/game', page: () => new GamePage(), requiresAuth: true },
		];

		routes.forEach(({ path, page, requiresAuth }) => {
			this.router.addRoute(path, {
				page: async () => page(),
				requiresAuth
			});
		});
	}

	private initializeApp(): void {
		/** Request notification permission when app loads */
		// this.requestNotificationPermission();
		/** Initialize global socket if user is already logged in */
		this.initializeGlobalSocket();
		/** Setup visibility change handler for socket reconnection */
		this.setupVisibilityChangeHandler();
	}

	private requestNotificationPermission(): void {
		if ('Notification' in window && Notification.permission === 'default') {
			Notification.requestPermission().then(permission => {
				if (permission === 'granted') {
					console.log('Notification permission granted');
				} else if (permission === 'denied') {
					console.log('Notification permission denied');
				}
			}).catch(error => {
				console.error('Error requesting notification permission:', error);
			});
		}
	}

	private initializeGlobalSocket(): void {
		const user = getStoredUser();
		if (user && this.token) {
			globalSocket.connect();
		}
	}

	private setupVisibilityChangeHandler(): void {
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible' && 
				getStoredUser() && 
				this.token && 
				!globalSocket.isConnected()) {
				console.log('Page became visible, reconnecting socket...');
				globalSocket.connect();
			}
		});
	}

	private bindEvents(): void {
		window.addEventListener('authSuccess', this.handleAuthSuccess.bind(this));
		window.addEventListener('logout', this.handleLogout.bind(this));
		window.addEventListener('navigate', (e) => this.router.navigate(e.detail.path));
		window.addEventListener('navigateToVerification', this.handleNavigateToVerification.bind(this));
		window.addEventListener('navigateToLogin', this.handleNavigateToLogin.bind(this));
		window.addEventListener('online', () => showNotification('Connection restored', 'success'));
		window.addEventListener('offline', () => showNotification('You are offline', 'error'));
		window.addEventListener('error', (e) => {
			console.error('Global error:', e.error);
			showError('An unexpected error occurred');
		});

		window.addEventListener('userLoggedIn', () => {
			console.log('User logged in event received, connecting socket...');
			globalSocket.connect();
		});

		window.addEventListener('userLoggedOut', () => {
			console.log('User logged out event received, disconnecting socket...');
			globalSocket.disconnect();
		});
	}

	private handleNavigateToVerification(event: CustomEvent<{ email?: string }>): void {
		this.router.navigate('/verify-email');
	}

	private handleNavigateToLogin(): void {
		this.router.navigate('/login');
	}

	private async handleAuthSuccess(event: CustomEvent<{ token: string; user?: User }>): Promise<void> {
		const { token, user } = event.detail;
		this.token = token;
		localStorage.setItem('token', token);
		try {
			this.currentUser = user || await getCurrentUser(token);
			localStorage.setItem('userData', JSON.stringify(this.currentUser));
			
			this.router.setAuthenticated(true);
			this.router.navigate('/dashboard');
			
			if (this.currentUser) {
				showNotification(`Welcome back ${this.currentUser.name}!`, 'success');
			}
			/** Dispatch userLoggedIn event to trigger socket connection */
			window.dispatchEvent(new CustomEvent('userLoggedIn'));
		} catch (error) {
			console.error('Authentication failed:', error);
			this.logout();
		}
	}

	private handleLogout(): void {
		this.logout();
	}

	private logout(): void {
		/** Dispatch userLoggedOut event before clearing data */
		window.dispatchEvent(new CustomEvent('userLoggedOut'));
		localStorage.removeItem('token');
		localStorage.removeItem('userData');
		this.token = null;
		this.currentUser = null;
		this.router.setAuthenticated(false);
		this.router.navigate('/login');
	}

	private showLoadingState(): void {
		const mainContent = document.getElementById('main-content');
		if (mainContent) {
			mainContent.innerHTML = `
				<div class="min-h-screen flex items-center justify-center bg-slate-900">
					<div class="text-center">
						<div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
						<h2 class="text-xl font-semibold text-white mb-2">Loading ft_transcendence</h2>
						<p class="text-gray-400">Please wait while we prepare your gaming experience...</p>
					</div>
				</div>
			`;
		}
	}

	public async start(): Promise<void> {
		this.showLoadingState();
		try {
			if (this.token) {
				this.currentUser = await getCurrentUser(this.token);
				localStorage.setItem('userData', JSON.stringify(this.currentUser));
				this.router.setAuthenticated(true);
				/** Connect socket if user validation is successful */
				if (this.currentUser) {
					globalSocket.connect();
				}
			} else {
				this.router.setAuthenticated(false);
			}
		} catch (error) {
			console.error('Token validation failed:', error);
			this.logout();
		}
		this.router.start();
	}
}

document.addEventListener('DOMContentLoaded', async () => {
	const app = new App();
	await app.start();
});

export { App };