import { User } from "auth";
import { API_CONFIG } from "./config";

const USER_API_BASE = `${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}`;

export interface GameStats {
	gamesPlayed: number;
	wins: number;
	losses: number;
	rating: number;
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

export interface FeaturedGame {
	id: string;
	name: string;
	description: string;
	icon: string;
	color: string;
}

export interface GameData {
	stats: GameStats;
	recentGames: RecentGame[];
	achievements: Achievement[];
	featuredGames: FeaturedGame[];
}

/** Fetch user's complete game data */
export async function fetchUserGameData(token: string): Promise<GameData> {
	try {
		const response = await fetch(`${USER_API_BASE}/dashboard`, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			}
		});
		
		if (!response.ok) {
			throw new Error('Failed to fetch user game data');
		}
		
		return response.json();
	} catch (error) {
		console.error('Error fetching game data:', error);
		// Return mock data for development/testing
		return {
			stats: {
				gamesPlayed: 0,
				wins: 0,
				losses: 0,
				rating: 1000
			},
			recentGames: [],
			achievements: [],
			featuredGames: [
				{
					id: 'game1',
					name: 'Chess',
					description: 'Classic strategy game',
					icon: '♟️',
					color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
				},
				{
					id: 'game2',
					name: 'Checkers',
					description: 'Simple board game',
					icon: '🔴',
					color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
				}
			]
		};
	}
}

/** Show loading state */
export function showLoadingState(elementId: string): void {
	const element = document.getElementById(elementId);
	if (!element) return;
	
	element.innerHTML = `
		<div class="flex flex-col items-center justify-center p-16 text-gray-400">
			<div class="w-8 h-8 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin mb-4"></div>
			<p>Loading...</p>
		</div>
	`;
}

/** Show empty state for any section */
export function showEmptyState(elementId: string, message: string, icon: string = '🎮'): void {
	const element = document.getElementById(elementId);
	if (!element) return;
	
	element.innerHTML = `
		<div class="text-center py-8 empty-state">
			<div class="text-4xl mb-4">${icon}</div>
			<p class="text-gray-400">${message}</p>
		</div>
	`;
}