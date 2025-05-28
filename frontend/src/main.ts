import { login, register, getCurrentUser, User } from "./auth";
import { showLoginForm, showWelcomeScreen, toggleMode, showError, hideError } from "./ui";

let isLoginMode = true;
let token: string | null = localStorage.getItem('token') || null;

document.addEventListener('DOMContentLoaded', async () => {
	bindEvents();
	if (token) {
		try {
			const user = await getCurrentUser(token);
			showWelcomeScreen(user);
		} catch {
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

	const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;
	logoutBtn.addEventListener('click', () => {
		localStorage.removeItem('token');
		token = null;
		showLoginForm();
	});
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
		showWelcomeScreen(user);
	} catch (err: any) {
		showError(err.message);
	} finally {
		submitBtn.disabled = false;
		submitText.classList.remove('hidden');
		submitLoading.classList.add('hidden');
	}
}