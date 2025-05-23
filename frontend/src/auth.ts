import { setupBabylon } from "./scene";
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
	try {
		const setup = await api2FASetup(email);
		if (!setup.qr || !setup.secret) {
			throw new Error('Invalid setup response');
		}
		localStorage.setItem('email', email);
		(document.getElementById('qrcode') as HTMLImageElement).src = setup.qr;
		document.getElementById('secret-text')!.textContent = setup.secret;
		toggleView('2fa-container');
	} catch (error) {
		console.error('2FA setup failed:', error);
		alert('Failed to setup 2FA. Please try again.');
	}
}

export function show2FAValidation() {
	try {
		toggleView('2fa-container');
	} catch (error) {
		console.error('2FA validation failed:', error);
		alert('Failed to show 2FA validation. Please try again.');
	}
}

export function showApp() {
	toggleView('app');
	setupBabylon();
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