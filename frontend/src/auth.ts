import { apiLogin, api2FASetup, api2FAVerify, api2FAValidate } from './api';

export async function onGoogleLogin(response:any) {
	const result = await apiLogin(response.credential);
	if (result.jwt) {
		localStorage.setItem('jwt', result.jwt);
		result.is2FAEnabled ? show2FAValidation() : await show2FASetup(result.email);
	} else {
		alert('Google login failed');
	}
}

export function setup2FAHandlers() {
	document.getElementById('verify-btn')?.addEventListener('click', async () => {
		const token = (document.getElementById('totp-code') as HTMLInputElement).value;
		const email = localStorage.getItem('email');
		if (!email) {
			alert('Email not found in localStorage.');
			return;
		}
		const res = await api2FAVerify(email, token);
		if (res.verified)
			showApp();
		else
			alert('Invalid code');
	});
}

export async function show2FASetup(email: string) {
	const setup = await api2FASetup(email);
	localStorage.setItem('email', email);
	(document.getElementById('qrcode') as HTMLImageElement).src = setup.qr;
	document.getElementById('secret-text')!.textContent = setup.secret;
	toggleView('2fa-container');
}

export function show2FAValidation() {
	toggleView('2fa-container');
}


export function showApp() {
	toggleView('app');
}

export function checkAuthOnLoad() {
	const jwt = localStorage.getItem('jwt');
	if (jwt) showApp();
}

function toggleView(showId: string) {
	['login-container', '2fa-container', 'app'].forEach(id => {
		const el = document.getElementById(id);
		if (el)
			el.classList.toggle('hidden', id !== showId);
	});
}