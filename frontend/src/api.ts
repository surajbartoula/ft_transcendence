const base = 'http://localhost:3001'

export async function apiLogin(token:string) {
	const res = await fetch(`${base}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token })
	});
	return await res.json();
}

export async function api2FASetup(email:string) {
	const res = await fetch(`${base}/2fa/setup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( { email })
	});
	return await res.json();
}

export async function api2FAVerify(email:string, token: string) {
	const res = await fetch(`${base}/2fa/verify`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, token })
	});
	return await res.json();
}

export async function api2FAValidate(email:string, token: string) {
	const res = await fetch(`${base}/2fa/validate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, token })
	});
	return await res.json();
}