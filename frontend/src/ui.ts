import type {User} from './auth.ts';

export function toggleMode(isLogin: boolean): void {
	document.getElementById('nameField')?.classList.toggle('hidden', isLogin);
	const submitText = document.getElementById('submitText');
	const switchText = document.getElementById('switchText');
	const switchMode = document.getElementById('switchMode');

	if (submitText) submitText.textContent = isLogin? 'Sign In': 'Sign Up';
	if (switchText) switchText.textContent = isLogin? "Don't have an account?" : 'Already have an account?';
	if (switchMode) switchMode.textContent = isLogin? 'Sign Up': 'Sign In';
	hideError();
}

export function showLoginForm(): void {
	document.getElementById('loading')?.classList.add('hidden');
	document.getElementById('loginContainer')?.classList.remove('hidden');
	document.getElementById('loginBg')?.classList.remove('hidden');
	document.getElementById('gameCanvas')?.classList.add('hidden');
}

export function showDashboard(): void {
	const loginContainer = document.getElementById('loginContainer');
	const dashboardContainer = document.getElementById('dashboardContainer');
	if (loginContainer) loginContainer.classList.add('hidden');
	if (dashboardContainer) dashboardContainer.classList.remove('hidden');
}

export function showError(message: string): void {
	const errorText = document.getElementById('errorText') as HTMLElement;
	const errorMessage = document.getElementById('errorMessage') as HTMLElement;

	errorText.textContent = message;
	errorMessage.classList.remove('hidden');
	errorMessage.classList.add('slide-up');
}

export function hideError(): void {
	document.getElementById('errorMessage')?.classList.add('hidden');
}

export function populateUserData(user: User): void {
	/** Update user profile section */
	const userInitials = document.getElementById('userInitials');
	const userName = document.getElementById('username');
	const userHandle = document.getElementById('userHandle');
	const userRating = document.getElementById('userRating');
	if (userInitials) {
		const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
		userInitials.textContent = initials;
	}
	if (userName) userName.textContent = user.name;
	if (userHandle) {
		/** Create handle from name if not provided */
		const handle = user.email ? `@${user.email.split('@')[0]}` : `@${user.name.toLowerCase().replace(/\s+/g, '')}`;
		userHandle.textContent = handle;
	}
	/** Default rating if not provided */
	if (userRating) userRating.textContent = (user as any).rating?.toString() || '1000';
}

export function updateGameStats(stats: {gamesPlayed: number; wins: number; losses: number}): void {
	const gamesPlayedEl = document.getElementById('gamesPlayed');
	const winsEl = document.getElementById('wins');
	const lossesEl = document.getElementById('losses');
	if (gamesPlayedEl) gamesPlayedEl.textContent = stats.gamesPlayed.toString();
	if (winsEl) winsEl.textContent = stats.wins.toString();
	if (lossesEl) lossesEl.textContent = stats.losses.toString();
}

export function showLoadingState(elementId: string, isLoading: boolean): void {
	const element = document.getElementById(elementId);
	if (!element) return;
	if (isLoading) {
		element.innerHTML = `
			<div class="flex items-center justify-center p-8">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				<span class="ml-2 text-gray-400">Loading...</span>
			</div>
		`;
	}
}

export function showEmptyState(elementId: string, message: string): void {
	const element = document.getElementById(elementId);
	if (!element) return;
	element.innerHTML = `
		<div class="flex items-center justify-center p-8 text-gray-400">
			<span>${message}</span>
		</div>
	`;
}

/** Section switching functions */
export function switchToSection(sectionName: string): void {
	/** Hide all sections */
	const sections = ['dashboard', 'profile', 'leaderboard', 'friends', 'settings'];
	sections.forEach(section => {
		const element = document.getElementById(`${section}Section`);
		if (element) element.classList.add('hidden');
	});
	/** Show selected section */
	const selectedSection = document.getElementById(`${sectionName}Section`);
	if (selectedSection) selectedSection.classList.remove('hidden');
	/** Update sidebar active state */
	const sidebarBtns = document.querySelectorAll('.sidebar-btn');
	sidebarBtns.forEach(btn => {
		btn.classList.remove('active', 'bg-blue-600');
		if (btn.getAttribute('data-section') === sectionName) btn.classList.add('active', 'bg-blue-600');
	});
}

/** Toast notification function */
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
	const toast = document.createElement('div');
	const bgColor = type == 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
	toast.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full`;
	toast.textContent = message;
	document.body.appendChild(toast);
	/** Animate in */
	setTimeout(() => {
		toast.classList.remove('translate-x-full');
	}, 100);
	/** Animate out and remove */
	setTimeout(() => {
		toast.classList.add('translate-x-full');
		setTimeout(() => {
			document.body.removeChild(toast);
		}, 300);
	}, 3000);
}

/** Modal functions */
export function showModal(title: string, content: string, onConfirm?: () => void): void {
	const modal = document.createElement('div');
	modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
	modal.innerHTML = `
		<div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
			<h3 class="text-gray-300 mb-6">${title}</h3>
			<p class="text-gray-300 mb-6">${content}</p>
			<div class="flex justify-end space-x-3">
				<button id="modalCancel" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition duration-200">Cancel</button>
				<button id="modalConfirm" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200">Confirm</button>
			</div>
		</div>
	`;
	document.body.appendChild(modal);
	const cancelBtn = modal.querySelector('#modalCancel');
	const confirmBtn = modal.querySelector('#modalConfirm');
	const closeModal = () => {
		document.body.removeChild(modal);
	};
	cancelBtn?.addEventListener('click', closeModal);
	confirmBtn?.addEventListener('click', () => {
		if (onConfirm) onConfirm();
		closeModal();
	});
	/** Close on backdrop click */
	modal.addEventListener('click', (e) => {
		if (e.target == modal) {
			closeModal();
		}
	});
}

export function hideModal(): void {
	const modal = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
	if (modal) {
		document.body.removeChild(modal);
	}
}