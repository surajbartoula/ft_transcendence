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
	document.getElementById('welcomeScreen')?.classList.add('hidden');
	document.getElementById('loginForm')?.classList.remove('hidden');
	document.getElementById('loginBg')?.classList.remove('hidden');
}

export function showWelcomeScreen(user: User): void {
	document.getElementById('loading')?.classList.add('hidden');
	document.getElementById('loginForm')?.classList.add('hidden');
	document.getElementById('loginBg')?.classList.add('hidden');
	document.getElementById('welcomeScreen')?.classList.remove('hidden');

	(document.getElementById('userName') as HTMLElement).textContent = user.name;
	(document.getElementById('userEmail') as HTMLElement).textContent = user.email;
	(document.getElementById('userId') as HTMLElement).textContent = user.id;
	(document.getElementById('userCreated') as HTMLElement).textContent = new Date(user.created_at).toLocaleDateString();
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