import { runBabylonGame } from "./scene";
import { login, register, getCurrentUser, User } from "./auth";
import { showLoginForm, showBabylonWelcome, toggleMode, showError, hideError } from "./ui";

let isLoginMode = true;
let token: string | null = localStorage.getItem('token') || null;

document.addEventListener('DOMContentLoaded', async () => {
	bindEvents();
	/**Check for Google OAuth callback token in URL*/
	const urlParams = new URLSearchParams(window.location.search);
	const googleToken = urlParams.get('token');
	if (googleToken) {
		/**Handle Google OAauth callback*/
		token = googleToken;
		localStorage.setItem('token', token);
		/**Clean the URL*/
		window.history.replaceState({}, document.title, window.location.pathname);
		try {
			const user = await getCurrentUser(token);
			localStorage.setItem('userData', JSON.stringify(user));
			showBabylonWelcome();
			runBabylonGame(user);
			return;
		} catch (error) {
			console.error('Failed to get user after Google OAuth:', error);
			localStorage.removeItem('token');
			token = null;
		}
	}
	if (token) {
		try {
			const user = await getCurrentUser(token);
			localStorage.setItem('userData', JSON.stringify(user));
			showBabylonWelcome();
			runBabylonGame(user);
		} catch (error) {
			console.error('Failed to get current user: ', error);
			localStorage.removeItem('userData');
			localStorage.removeItem('token');
			token = null;
			showLoginForm();
		}
	} else {
		showLoginForm();
	}
});

function bindEvents(): void {
	const form = document.getElementById('authForm') as HTMLFormElement;
	form.addEventListener('submit', handleSubmit);

	const switchBtn = document.getElementById('switchMode') as HTMLButtonElement;
	switchBtn.addEventListener('click', () => {
		isLoginMode = !isLoginMode;
		toggleMode(isLoginMode);
	});

	/**Google Sign-In button */
	const googleBtn = document.getElementById('googleSignInBtn') as HTMLButtonElement;
	if (googleBtn) {
		googleBtn.addEventListener('click', handleGoogleSignIn);
	}

	const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;
	if (logoutBtn) {
		logoutBtn.addEventListener('click', () => {
			localStorage.removeItem('token');
			localStorage.removeItem('userData');
			token = null;
			showLoginForm();
		});
	}
}

async function handleSubmit(e:Event): Promise<void> {
	e.preventDefault();

	const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
	const submitText = document.getElementById('submitText') as HTMLElement;
	const submitLoading = document.getElementById('submitLoading') as HTMLElement;

	submitBtn.disabled = true;
	submitText.classList.add('hidden');
	submitLoading.classList.remove('hidden');

	try {
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const name = formData.get('name') as string;

		let user: User;

		if (isLoginMode) {
			const res = await login(email, password);
			token = res.token;
			user = res.user;
		} else {
			if (!name) throw new Error('Name is required');
			const res = await register(name, email, password);
			token = res.token;
			user = res.user;
		}
		localStorage.setItem('token', token);
		localStorage.setItem('userData', JSON.stringify(user));
		showBabylonWelcome();
		runBabylonGame(user);
	} catch (err: any) {
		showError(err.message);
	} finally {
		submitBtn.disabled = false;
		submitText.classList.remove('hidden');
		submitLoading.classList.add('hidden');
	}
}

/**
 * Google Sign-In handler
 */
function handleGoogleSignIn(): void {
	const googleBtn = document.getElementById('googleSignInBtn') as HTMLButtonElement;
	const googleBtnText = document.getElementById('googleBtnText') as HTMLElement;
	const googleBtnLoading = document.getElementById('googleBtnLoading') as HTMLElement;
	googleBtn.disabled = true;
	if (googleBtnText) googleBtnText.classList.add('hidden');
	if (googleBtnLoading) googleBtnLoading.classList.remove('hidden');
	window.location.href = 'http://localhost:3001/api/auth/google';
}
