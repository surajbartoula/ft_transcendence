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
	document.getElementById('loginForm')?.classList.remove('hidden');
	document.getElementById('loginBg')?.classList.remove('hidden');
	document.getElementById('gameCanvas')?.classList.add('hidden');
}

export function showBabylonWelcome(): void {
	document.getElementById('loading')?.classList.add('hidden');
	document.getElementById('loginForm')?.classList.add('hidden');
	document.getElementById('loginBg')?.classList.add('hidden');
	document.getElementById('gameCanvas')?.classList.remove('hidden');
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