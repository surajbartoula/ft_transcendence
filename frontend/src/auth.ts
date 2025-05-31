const API_BASE = 'http://localhost:3001/api/auth';

export interface User {
	id: string;
	name: string;
	email: string;
	created_at: string;
}

export interface LoginResponse {
	token: string;
	user: User;
}

export async function login(email:string, password: string): Promise<LoginResponse> {
	const res = await fetch(`${API_BASE}/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({email, password}),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || 'Login failed');
	return data;
}

export async function register(name:string, email: string, password: string): Promise<{token: string, user: User}> {
	const res = await fetch(`${API_BASE}/register`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({name, email, password}),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || 'Registration failed');
	return data;
}

export async function getCurrentUser(token:string): Promise<User> {
	const res = await fetch(`${API_BASE}/me`, {
		headers: {Authorization: `Bearer ${token}`},
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || 'Failed to fetch user');
	return data.user;
}

export async function logout(): Promise<void> {
	localStorage.removeItem('token');
	localStorage.removeItem('userData');
}