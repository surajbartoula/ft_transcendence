const API_BASE = 'http://localhost:3001/api/auth';

export interface User {
	id: string;
	name: string;
	email: string;
	created_at: string;
}

async function handleResponse<T>(res:Response): Promise<T> {
	if (!res.ok) {
		let message = 'Unknown error';
		try {
			const error = await res.json();
			message = error.erro || message;
		} catch {}
		throw new Error(message);
	}
	return res.json();
}

export async function login(email:string, password: string): Promise<{token: string, user: User}> {
	const res = await fetch(`${API_BASE}/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({email, password}),
	});
	return handleResponse(res);
}

export async function register(name:string, email: string, password: string): Promise<{token: string, user: User}> {
	const res = await fetch(`${API_BASE}/register`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({name, email, password}),
	});
	return handleResponse(res);
}

export async function getCurrentUser(token:string): Promise<User> {
	const res = await fetch(`${API_BASE}/me`, {
		headers: {Authorization: `Bearer ${token}`},
	});
	const data = await handleResponse<{user: User}>(res);
	return data.user;
}