import { Router } from './router/Router';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatPage } from './pages/ChatPage';
import { GameMenuPage } from './pages/GameMenuPage';
import { SharedGamePage } from './pages/SharedGamePage';
import { TournamentSetupPage } from './pages/TournamentSetupPage';
import { TournamentBracketPage } from './pages/TournamentBracketPage';
import { RemoteTournamentGamePage } from './pages/RemoteTournamentGamePage';
import { RemoteTournamentLobbyPage } from './pages/RemoteTournamentLobbyPage';
import { RemoteTournamentBracketPage } from './pages/RemoteTournamentBracketPage';
import { OnlineMatchLobbyPage } from './pages/OnlineMatchLobbyPage';
import { RemoteGamePage } from './pages/RemoteGamePage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { getCurrentUser, User, getStoredUser } from './utils/auth';
import { showNotification, showError, clearAllClickableNotifications } from './utils/ui';
import globalSocket from './utils/globalSocket';
import gameSocket from './utils/gameSocket';

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

	private createAuthSuccessPage() {
		return {
			render: () => `
				<div class="min-h-screen flex items-center justify-center bg-slate-900">
					<div class="text-center">
						<div class="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
						<h2 class="text-xl font-semibold text-white mb-2">Completing Authentication</h2>
						<p class="text-gray-400">Please wait while we log you in...</p>
					</div>
				</div>
			`,
			initialize: () => {
				// Extract token from URL and trigger auth success
				const urlParams = new URLSearchParams(window.location.search);
				const token = urlParams.get('token');
				const error = urlParams.get('error');
				
				if (error) {
					showError(decodeURIComponent(error));
					this.router.navigate('/login');
					return;
				}
				
				if (token) {
					// Clean URL
					window.history.replaceState({}, document.title, '/auth/success');
					// Trigger auth success event
					window.dispatchEvent(new CustomEvent('authSuccess', { 
						detail: { token, user: null } 
					}));
				} else {
					showError('No authentication token received');
					this.router.navigate('/login');
				}
			},
			title: 'Authentication Success'
		};
	}

	private setupRoutes(): void {
		const routes = [
			{ path: '/', page: () => new LoginPage(), requiresAuth: false },
			{ path: '/login', page: () => new LoginPage(), requiresAuth: false },
			{ path: '/auth/success', page: () => this.createAuthSuccessPage(), requiresAuth: false },
			{ path: '/verify-email', page: () => new EmailVerificationPage(), requiresAuth: false},
			{ path: '/dashboard', page: () => new DashboardPage(), requiresAuth: true },
			{ path: '/dashboard/profile', page: () => new ProfilePage(), requiresAuth: true },
			{ path: '/dashboard/leaderboard', page: () => new LeaderboardPage(), requiresAuth: true },
			{ path: '/dashboard/settings', page: () => new SettingsPage(), requiresAuth: true },
			{ path: '/chat', page: () => new ChatPage(), requiresAuth: true },
			{ path: '/game', page: () => new GameMenuPage(), requiresAuth: true },
			{ path: '/game/play', page: () => new SharedGamePage(), requiresAuth: true },
			{ path: '/game/online', page: () => new OnlineMatchLobbyPage(), requiresAuth: true },
			{ path: '/game/remote/match', page: () => new RemoteGamePage(), requiresAuth: true },
			{ path: '/game/tournament/setup', page: () => new TournamentSetupPage(), requiresAuth: true },
			{ path: '/game/tournament/bracket', page: () => new TournamentBracketPage(), requiresAuth: true },
			{ path: '/game/tournament/match', page: () => new RemoteTournamentGamePage(), requiresAuth: true },
			{ path: '/game/tournament/remote/lobby', page: () => new RemoteTournamentLobbyPage(), requiresAuth: true },
			{ path: '/game/tournament/remote/bracket', page: () => new RemoteTournamentBracketPage(), requiresAuth: true },
			{ path: '/game/tournament/remote/match', page: () => new RemoteTournamentGamePage(), requiresAuth: true },
		];

		routes.forEach(({ path, page, requiresAuth }) => {
			this.router.addRoute(path, {
				page: async () => {
					if (!requiresAuth) {
						clearAllClickableNotifications();
					}
					return page();
				},
				requiresAuth
			});
		});
	}

	private initializeApp(): void {
		/** Request notification permission when app loads */
		// this.requestNotificationPermission();
		/** Initialize sockets if user is already logged in */
		this.initializeSockets();
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

	private initializeSockets(): void {
		const user = getStoredUser();
		if (user && this.token) {
			globalSocket.connect();
			gameSocket.connect();
		}
	}

	private setupVisibilityChangeHandler(): void {
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible' && 
				getStoredUser() && 
				this.token) {
				if (!globalSocket.isConnected()) {
					console.log('Page became visible, reconnecting global socket...');
					globalSocket.connect();
				}
				if (!gameSocket.isConnected()) {
					console.log('Page became visible, reconnecting game socket...');
					gameSocket.connect();
				}
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
			console.log('User logged in event received, connecting sockets...');
			globalSocket.connect();
			gameSocket.connect();
		});

		window.addEventListener('userLoggedOut', () => {
			console.log('User logged out event received, disconnecting sockets...');
			globalSocket.disconnect();
			gameSocket.disconnect();
		});
	}

	private handleNavigateToVerification(event: CustomEvent<{ email?: string }>): void {
		clearAllClickableNotifications();
		this.router.navigate('/verify-email');
	}

	private handleNavigateToLogin(): void {
		clearAllClickableNotifications();
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
		clearAllClickableNotifications();
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
				/** Connect sockets if user validation is successful */
				if (this.currentUser) {
					globalSocket.connect();
					gameSocket.connect();
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