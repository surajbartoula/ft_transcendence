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
        // Fetch stats and recent games in parallel
        const [statsResponse, historyResponse] = await Promise.all([
            fetch(`/api/game/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`/api/game/history?limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);
        
        if (!statsResponse.ok) {
            console.warn('Game service not available, using default stats');
            return getDefaultGameData();
        }
        
        // Parse stats
        const statsText = await statsResponse.text();
        if (!statsText.trim()) {
            console.warn('Empty response from game service, using default stats');
            return getDefaultGameData();
        }
        
        let stats;
        try {
            const statsData = JSON.parse(statsText);
            if (statsData && statsData.stats) {
                stats = {
                    rating: statsData.stats.ranking_points || 1000,
                    gamesPlayed: statsData.stats.total_games || 0,
                    wins: statsData.stats.wins || 0,
                    losses: statsData.stats.losses || 0,
                    winRate: statsData.stats.win_rate || 0
                };
            } else {
                console.warn('Invalid stats response structure');
                return getDefaultGameData();
            }
        } catch (parseError) {
            console.warn('Invalid JSON from game service:', parseError);
            return getDefaultGameData();
        }
        
        // Parse recent games
        let recentGames: RecentGame[] = [];
        if (historyResponse.ok) {
            try {
                const historyData = await historyResponse.json();
                if (historyData.success && historyData.games) {
                    recentGames = historyData.games.slice(0, 5).map((game: any) => ({
                        id: game.id.toString(),
                        game: `Pong ${game.game_mode}`,
                        opponent: getOpponentName(game),
                        result: game.result as 'win' | 'loss',
                        score: `${game.player1_score}-${game.player2_score}`,
                        date: formatGameDate(game.finished_at)
                    }));
                }
            } catch (historyError) {
                console.warn('Failed to parse game history:', historyError);
            }
        }
        
        // Generate achievements based on stats
        const achievements = generateAchievements(stats, recentGames);
        
        return {
            stats,
            recentGames,
            achievements
        };
    } catch (error) {
        console.warn('Game service connection failed, using default stats:', error);
        return getDefaultGameData();
    }
}

function getOpponentName(game: any): string {
    // Since we don't have opponent usernames in the game history,
    // we'll show player IDs or generic names based on game mode
    if (game.game_mode === 'ai') {
        return 'AI';
    } else if (game.game_mode === 'local') {
        return 'Local Player';
    } else if (game.game_mode === 'tournament') {
        return 'Tournament Player';
    } else {
        // For remote games, we'd need to fetch the opponent's username
        // For now, just show a generic name
        return `Player ${game.player_role === 'player1' ? game.player2_id : game.player1_id}`;
    }
}

function formatGameDate(dateString: string): string {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function generateAchievements(stats: GameStats, recentGames: RecentGame[]): Achievement[] {
    const achievements: Achievement[] = [];
    const now = new Date().toISOString();
    
    // First game achievement
    if (stats.gamesPlayed >= 1) {
        achievements.push({
            id: 'first_game',
            name: 'Welcome to Pong!',
            description: 'Played your first game',
            icon: '🎮',
            unlockedAt: now
        });
    }
    
    // Win achievements
    if (stats.wins >= 1) {
        achievements.push({
            id: 'first_win',
            name: 'First Victory',
            description: 'Won your first game',
            icon: '🏆',
            unlockedAt: now
        });
    }
    
    if (stats.wins >= 5) {
        achievements.push({
            id: 'five_wins',
            name: 'Getting Good',
            description: 'Won 5 games',
            icon: '⭐',
            unlockedAt: now
        });
    }
    
    if (stats.wins >= 10) {
        achievements.push({
            id: 'ten_wins',
            name: 'Pong Master',
            description: 'Won 10 games',
            icon: '👑',
            unlockedAt: now
        });
    }
    
    // Win rate achievements
    if (stats.gamesPlayed >= 5 && stats.winRate >= 80) {
        achievements.push({
            id: 'high_winrate',
            name: 'Dominator',
            description: '80%+ win rate with 5+ games',
            icon: '💪',
            unlockedAt: now
        });
    }
    
    // Rating achievements
    if (stats.rating >= 1200) {
        achievements.push({
            id: 'rating_1200',
            name: 'Rising Star',
            description: 'Reached 1200 rating',
            icon: '🌟',
            unlockedAt: now
        });
    }
    
    if (stats.rating >= 1500) {
        achievements.push({
            id: 'rating_1500',
            name: 'Elite Player',
            description: 'Reached 1500 rating',
            icon: '💎',
            unlockedAt: now
        });
    }
    
    // Recent activity achievements
    const recentWins = recentGames.filter(game => game.result === 'win').length;
    if (recentWins >= 3) {
        achievements.push({
            id: 'recent_streak',
            name: 'On Fire!',
            description: '3+ wins in recent games',
            icon: '🔥',
            unlockedAt: now
        });
    }
    
    return achievements.slice(0, 4); // Show max 4 achievements
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
