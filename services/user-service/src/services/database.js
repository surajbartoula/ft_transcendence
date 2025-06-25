import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs';
import dotenv from 'dotenv'
import path, { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export class DatabaseService {
	constructor() {
		this.db = null;
	}

	getDatabasePath() {
		const isDocker = process.env.DOCKER_ENV || fs.existsSync('/app');
		if (isDocker) {
			const dataDir = '/app/data'
			if (!fs.existsSync(dataDir)) {
				fs.mkdirSync(dataDir, { recursive: true });
			}
			return path.join(dataDir, 'users.db');
		} else {
			return './users.db';
		}
	}

	async initialize() {
		const dbPath = this.getDatabasePath();
		this.db = new sqlite3.Database(dbPath, (err) => {
			if (err) {
				console.error('Error creating userdatabase:', err.message);
				throw err;
			}
			console.log('User database successfully created');
		});
		/** Promisify database methods */
		this.db.runAsync = promisify(this.db.run.bind(this.db));
		this.db.getAsync = promisify(this.db.get.bind(this.db));
		this.db.allAsync = promisify(this.db.all.bind(this.db));
		await this.createTables();
		await this.seedData();
	}

	async createTables() {
		const tables = [
			/** User profile table */
			`CREATE TABLE IF NOT EXISTS user_profiles (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT UNIQUE NOT NULL,
				username TEXT UNIQUE NOT NULL,
				email TEXT UNIQUE NOT NULL,
				avatar_url TEXT,
				bio TEXT,
				location TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
			)`,
		    /** User statistic table */
			`CREATE TABLE IF NOT EXISTS user_stats (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT UNIQUE NOT NULL,
				games_played INTEGER DEFAULT 0,
				games_won INTEGER DEFAULT 0,
				total_score INTEGER DEFAULT 0,
				best_score INTEGER DEFAULT 0,
				level INTEGER DEFAULT 1,
				experience_points INTEGER DEFAULT 0,
				win_rate REAL DEFAULT 0.0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
			)`,
			
			/** Achievement table */
			`CREATE TABLE IF NOT EXISTS achievements (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT UNIQUE NOT NULL,
				description TEXT NOT NULL,
				icon TEXT,
				points INTEGER DEFAULT 0,
				rarity TEXT DEFAULT 'common',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)`,
			
			/** User achievement table */
			`CREATE TABLE IF NOT EXISTS user_achievements (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT NOT NULL,
				achievement_id INTEGER NOT NULL,
				earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES user_profiles(user_id),
				FOREIGN KEY (achievement_id) REFERENCES achievements(id),
				UNIQUE(user_id, achievement_id)
			)`,
			
			/** Friend table */
			`CREATE TABLE IF NOT EXISTS friendships (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				requester_id TEXT NOT NULL,
				recipient_id TEXT NOT NULL,
				status TEXT DEFAULT 'pending',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (requester_id) REFERENCES user_profiles(user_id),
				FOREIGN KEY (recipient_id) REFERENCES user_profiles(user_id),
				UNIQUE(requester_id, recipient_id)
			)`,
			
			/** Game session table */
			`CREATE TABLE IF NOT EXISTS game_sessions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT NOT NULL,
				game_type TEXT NOT NULL,
				score INTEGER DEFAULT 0,
				duration INTEGER DEFAULT 0,
				completed BOOLEAN DEFAULT FALSE,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
			)`
		];
		for (const table of tables) {
			await this.db.runAsync(table);
		}
		    const indexes = [
				'CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id)',
				'CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id)',
				'CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id)',
				'CREATE INDEX IF NOT EXISTS idx_friendships_recipient ON friendships(recipient_id)',
				'CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id)'
			];
		for (const index of indexes) {
			await this.db.runAsync(index);
		}
	}

	async seedData() {
		/** Check if achievement already exist */
		const existingAchievements = await this.db.getAsync('SELECT COUNT(*) as count FROM achievements');
		if (existingAchievements.count === 0) {
			const achievements = [
				{ name: 'First Steps', description: 'Play your first game', icon: '🎮', points: 10, rarity: 'common' },
				{ name: 'Rookie', description: 'Win your first game', icon: '🏆', points: 25, rarity: 'common' },
				{ name: 'Veteran', description: 'Play 100 games', icon: '⭐', points: 100, rarity: 'uncommon' },
				{ name: 'Champion', description: 'Win 50 games', icon: '👑', points: 200, rarity: 'rare' },
				{ name: 'High Scorer', description: 'Score over 10,000 points in a single game', icon: '💯', points: 150, rarity: 'uncommon' },
				{ name: 'Social Butterfly', description: 'Add 10 friends', icon: '👥', points: 75, rarity: 'uncommon' },
				{ name: 'Perfectionist', description: 'Win 10 games in a row', icon: '🔥', points: 300, rarity: 'epic' },
				{ name: 'Legend', description: 'Reach level 50', icon: '🌟', points: 500, rarity: 'legendary' }
			];
			for (const achievement of achievements) {
				await this.db.runAsync(
					'INSERT INTO achievements (name, description, icon, points, rarity) VALUES (?, ?, ?, ?, ?)',
					  [achievement.name, achievement.description, achievement.icon, achievement.points, achievement.rarity]
				);
			}
		}
	}

	async createUserProfile(userData) {
		const { user_id, username, email, avatar_url, bio, location } = userData;
		await this.db.runAsync(`
			INSERT INTO user_profiles (user_id, username, email, avatar_url, bio, location)
      		VALUES (?, ?, ?, ?, ?, ?)
		`, [user_id, username, email, avatar_url || null, bio || null, location || null]);
		await this.db.runAsync(`
			INSERT INTO user_stats (user_id) VALUES (?)
		`, [user_id]);
		return this.getUserProfile(user_id);
	}

	async getUserProfile(user_id) {
		return await this.db.getAsync(`
			SELECT p.*, s.games_played, s.games_won, s.total_score, s.best_score, 
            		s.level, s.experience_points, s.win_rate
			FROM user_profiles p
			LEFT JOIN user_stats s ON p.user_id = s.user_id
			WHERE p.user_id = ?
		`, [user_id]);
	}

	async updateUserProfile(user_id, updateData) {
		const fields = [];
		const values = [];
		const allowedFields = ['username', 'email', 'avatar_url', 'bio', 'location'];
		for (const [key, value] of Object.entries(updateData)) {
			if (allowedFields.includes(key)) {
				fields.push(`${key} = ?`);
				values.push(value);
			}
		}
		if (fields.length == 0) {
			throw new Error('No valid fields to update');
		}
		values.push(user_id);
		await this.db.runAsync(`
			UPDATE user_profiles 
			SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
			WHERE user_id = ?
		`, values);
		return this.getUserProfile(user_id);
	}

	async updateLastSeen(user_id) {
		await this.db.runAsync(
			'UPDATE user_profiles SET last_seen = CURRENT_TIMESTAMP WHERE user_id = ?',
      		[user_id]
		);
	}

	async updateUserStats(user_id, stats) {
		const fields = [];
		const values = [];
		const allowedFields = ['games_played', 'games_won', 'total_score', 'best_score', 'level', 'experience_points'];
		for (const [key, value] of Object.entries(stats)) {
			if (allowedFields.includes(key)) {
				fields.push(`${key} = ?`);
				values.push(value);
			}
		}
		/** Calculate win rate */
		if (stats.games_played && stats.games_won) {
			fields.push('win_rate = ?');
			values.push(stats.games_won / stats.games_played);
		}
		values.push(user_id);
		await this.db.runAsync(`
			UPDATE user_stats 
			SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
			WHERE user_id = ?
		`, values);
		return this.getUserStats(user_id);
	}

	async getUserAchievements(user_id) {
		return await this.db.allAsync(`
			SELECT a.*, ua.earned_at
			FROM achievements a
			JOIN user_achievements ua ON a.id = ua.achievement_id
			WHERE ua.user_id = ?
			ORDER BY ua.earned_at DESC
		`, [user_id]);
	}

	async awardAchievement(user_id, achievement_id) {
		try {
			await this.db.runAsync(
				'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
        		[user_id, achievement_id]
			);
			return true;
		} catch (error) {
			if (error.code === 'SQLITE_CONSTRAINT') {
				return false; //Already have this achievement
			}
			throw error;
		}
	}

	async getallAchievements() {
		return await this.db.allAsync('SELECT * FROM achievements ORDER BY points ASC');
	}

	async getFriends(user_id) {
		return await this.db.allAsync(`
			SELECT 
				p.user_id, p.username, p.avatar_url, p.last_seen,
				f.status, f.created_at as friend_since
			FROM friendships f
			JOIN user_profiles p ON (
				CASE 
				WHEN f.requester_id = ? THEN p.user_id = f.recipient_id
				ELSE p.user_id = f.requester_id
				END
			)
			WHERE (f.requester_id = ? OR f.recipient_id = ?) AND f.status = 'accepted'
			ORDER BY p.last_seen DESC
		`, [user_id, user_id, user_id]);
	}

	async sendFriendRequest(requester_id, recipient_id) {
		await this.db.runAsync(
			'INSERT INTO friendships (requester_id, recipient_id, status) VALUES (?, ?, ?)',
			[requester_id, recipient_id, 'pending']
		);
	}

	async updateFriendshipStatus(requester_id, recipient_id, status) {
		await this.db.runAsync(
	    	'UPDATE friendships SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE requester_id = ? AND recipient_id = ?',
      		[status, requester_id, recipient_id]
		);
	}

	async getFriendRequests(user_id) {
		return await this.db.allAsync(`
	    	SELECT 
        		p.user_id, p.username, p.avatar_url,
        		f.created_at as requested_at
			FROM friendships f
			JOIN user_profiles p ON p.user_id = f.requester_id
			WHERE f.recipient_id = ? AND f.status = 'pending'
			ORDER BY f.created_at DESC
		`, [user_id]);
	}

	async addGameSession(user_id, game_type, score, duration, completed) {
		await this.db.runAsync(
			'INSERT INTO game_sessions (user_id, game_type, score, duration, completed) VALUES (?, ?, ?, ?, ?)',
			[user_id, game_type, score, duration, completed]
		);
	}

	async getRecentGames(user_id, limit = 10) {
		return await this.db.allAsync(
	    	'SELECT * FROM game_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      		[user_id, limit]
		);
	}

	async getLeaderboard(limit = 50) {
		return await this.db.allAsync(`
	    	SELECT 
        		p.user_id, p.username, p.avatar_url,
        		s.total_score, s.games_won, s.games_played, s.win_rate, s.level
			FROM user_profiles p
			JOIN user_stats s ON p.user_id = s.user_id
			ORDER BY s.total_score DESC, s.win_rate DESC
			LIMIT ?
		`, [limit]);
	}

	async getUserStats(user_id) {
		return await this.db.getAsync(`
			SELECT * FROM user_stats WHERE user_id = ?
		`, [user_id]);
	}

	async close() {
		if (this.db) {
			await new Promise((resolve, reject) => {
				this.db.close((err) => {
					if (err) reject(err);
					else resolve();
				});
			});
		}
	}
}