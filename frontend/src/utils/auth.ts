import { API_CONFIG } from '../config';
import { clearAllClickableNotifications } from './ui';

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
	message: string;
	token?: string;
	user?: User;
	requiresVerification?: boolean;
	email?: string;
	redirectTo?: string;
	requires2FA?: boolean;
}

const API_BASE = API_CONFIG.ENDPOINTS.AUTH;

/**
 * Email verificaton part
 */

export const verifyEmail = async (email: string, code: string): Promise<LoginResponse> => {
	const response = await fetch(`${API_BASE}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
	})
	const data = await response.json();
	if (!response.ok) {
		throw new Error(data.error || 'Email verification failed');
	}
	return data;
};

export const resendVerificationCode = async (email: string): Promise<LoginResponse> => {
	const response = await fetch(`${API_BASE}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
	})
	const data = await response.json();
	if (!response.ok) {
		throw new Error(data.error || 'Failed to resend verification code');
	}
	return data;
};

/**
 * Login part
 */

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
	clearAllClickableNotifications();
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

export function setStoredUser(user: any): void {
    localStorage.setItem('userData', JSON.stringify(user));
    /** Trigger global socket connection */
    window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: user }));
}

export function clearStoredAuth(): void {
	clearAllClickableNotifications();
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    /** Trigger global socket disconnection */
    window.dispatchEvent(new CustomEvent('userLoggedOut'));
}