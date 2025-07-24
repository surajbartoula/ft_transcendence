import { API_CONFIG } from '../config';

export interface User {
    id: string;
    name: string;
    email: string;
    created_at: string;
    photo?: {
        id: string;
        user_id: string;
        filename: string;
        path: string;
        created_at: string;
        updated_at: string;
    };
}

export interface LoginResponse {
    token: string;
    user: User;
}

const API_BASE = `${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.AUTH}`;

export async function login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    return data;
}

export async function register(name: string, email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed');
    return data;
}

export async function getCurrentUser(token: string): Promise<User> {
    const response = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch user');
    return data.user;
}

export async function refreshToken(token: string): Promise<string> {
    const response = await fetch(`${API_BASE}/refresh`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to refresh token');
    return data.token;
}

export function logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
}

export function isTokenExpired(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return Date.now() >= payload.exp * 1000;
    } catch {
        return true;
    }
}

export function getStoredUser(): User | null {
    const userDataStr = localStorage.getItem('userData');
    if (userDataStr) {
        try {
            return JSON.parse(userDataStr);
        } catch {
            return null;
        }
    }
    return null;
}

export function getStoredToken(): string | null {
    return localStorage.getItem('token');
}