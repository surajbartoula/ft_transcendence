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

const USER_API_BASE = "/api/user";

export async function fetchUserGameData(token: string): Promise<GameData> {
    try {
        const response = await fetch(`/api/game/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            console.warn('Game service not available, using default stats');
            return getDefaultGameData();
        }
        
        const text = await response.text();
        if (!text.trim()) {
            console.warn('Empty response from game service, using default stats');
            return getDefaultGameData();
        }
        
        try {
            const responseData = JSON.parse(text);
            // Game service returns { success: true, stats: {...} }
            if (responseData && responseData.stats) {
                return {
                    stats: {
                        rating: responseData.stats.rating || 1000,
                        gamesPlayed: responseData.stats.total_games || 0,
                        wins: responseData.stats.wins || 0,
                        losses: responseData.stats.losses || 0,
                        winRate: responseData.stats.win_rate || 0
                    },
                    recentGames: [], // Game service doesn't provide this yet
                    achievements: [] // Game service doesn't provide this yet
                };
            } else {
                console.warn('Invalid response structure from game service, using default stats');
                return getDefaultGameData();
            }
        } catch (parseError) {
            console.warn('Invalid JSON from game service, using default stats:', parseError);
            return getDefaultGameData();
        }
    } catch (error) {
        console.warn('Game service connection failed, using default stats:', error);
        return getDefaultGameData();
    }
}

function getDefaultGameData(): GameData {
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
