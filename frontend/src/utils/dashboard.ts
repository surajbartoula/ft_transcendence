import { API_CONFIG } from '../config';

export interface GameStats {
    rating: number;
    gamesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
}

export interface RecentGame {
    id: string;
    game: string;
    opponent: string;
    result: 'win' | 'loss';
    score: string;
    date: string;
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlockedAt: string;
}

export interface GameData {
    stats: GameStats;
    recentGames: RecentGame[];
    achievements: Achievement[];
}

const USER_API_BASE = `${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}`;

export async function fetchUserGameData(token: string): Promise<GameData> {
    const response = await fetch(`${USER_API_BASE}/game-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
        // Return default data if API fails
        return {
            stats: {
                rating: 1000,
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                winRate: 0
            },
            recentGames: [],
            achievements: []
        };
    }
    
    return response.json();
}

export async function fetchUserProfile(token: string): Promise<any> {
    const response = await fetch(`${USER_API_BASE}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch profile');
    return response.json();
}

export async function fetchLeaderboard(token: string, filters?: any): Promise<any[]> {
    let url = `${USER_API_BASE}/leaderboard`;
    
    if (filters) {
        const params = new URLSearchParams(filters);
        url += `?${params.toString()}`;
    }
    
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch leaderboard');
    return response.json();
}

export async function fetchFriends(token: string): Promise<any[]> {
    const response = await fetch(`${USER_API_BASE}/friends`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch friends');
    return response.json();
}
