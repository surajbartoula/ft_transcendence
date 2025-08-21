import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs';
import dotenv from 'dotenv'
import path from 'path';
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
		this.db = await new Promise((resolve, reject) => {
			const db = new sqlite3.Database(dbPath, (err) => {
				if (err) {
					console.log("Error creating userdatabase:", err.message);
					reject(err);
				}
				console.log("User database created successfully");
				resolve(db);
			});
		});
		this.db.runAsync = (sql, params = []) => {
			return new Promise((resolve, reject) => {
			this.db.run(sql, params, function (err) {
				if (err) return reject(err);
				resolve({ lastID: this.lastID, changes: this.changes });
			});
			});
		};
		this.db.getAsync = promisify(this.db.get.bind(this.db));
		this.db.allAsync = promisify(this.db.all.bind(this.db));
		await this.createTables();
	}

	async createTables() {
		await this.db.runAsync(`
			CREATE TABLE IF NOT EXISTS profiles (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL UNIQUE,
			username TEXT NOT NULL,
			bio TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);

		await this.db.runAsync(`
			CREATE TABLE IF NOT EXISTS photos (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL UNIQUE,
			filename TEXT NOT NULL,
			path TEXT NOT NULL,
			uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE
			)
		`);

		await this.db.runAsync(`
			CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id)
		`);
	}

	async createProfile({ user_id, username, bio }) {
		try {
			const query = `
				INSERT INTO profiles (user_id, username, bio)
				VALUES (?, ?, ?)
			`;
			await this.db.runAsync(query, [user_id, username, bio || null]);
			return this.getProfile(user_id);
		} catch (error) {
			if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
				throw new Error('Profile already exists for this user');
			}
			throw error;
		}
	}

	async updateProfile(user_id, updates) {
		const fields = [];
		const values = [];
		if (updates.username !== undefined) {
			fields.push('username = ?');
			values.push(updates.username);
		}
		if (updates.bio !== undefined) {
			fields.push('bio = ?');
			values.push(updates.bio);
		}
		if (fields.length === 0) {
			return this.getProfile(user_id);
		}
		values.push(user_id);
		const query = `
			UPDATE profiles
			SET ${fields.join(', ')}
			WHERE user_id = ?
		`;
		await this.db.runAsync(query, values);
		return this.getProfile(user_id);
	}

	async getProfile(user_id) {
		return await this.db.getAsync(`SELECT * FROM profiles WHERE user_id = ?`, [user_id]);
	}

	async listProfiles() {
		return await this.db.allAsync(`SELECT * FROM profiles`);
	}

	async addOrUpdatePhoto({ user_id, filename, path }) {
		try {
			const existingPhoto = await this.getPhoto(user_id);
			if (existingPhoto) {
			const query = `
				UPDATE photos 
				SET filename = ?, path = ?, uploaded_at = CURRENT_TIMESTAMP
				WHERE user_id = ?
			`;
			await this.db.runAsync(query, [filename, path, user_id]);
			} else {
				const query = `
					INSERT INTO photos (user_id, filename, path)
					VALUES (?, ?, ?)
				`;
				await this.db.runAsync(query, [user_id, filename, path]);
			}
			
			return this.getPhoto(user_id);
		} catch (error) {
			console.error('Error in addOrUpdatePhoto:', error);
			throw error;
		}
	}

	async getPhoto(user_id) {
		return await this.db.getAsync(`SELECT * FROM photos WHERE user_id = ?`, [user_id]);
	}

	async deletePhoto(user_id) {
		const query = `DELETE FROM photos WHERE user_id = ?`;
		await this.db.runAsync(query, [user_id]);
	}

	async deleteProfile(user_id) {
		const query = `DELETE FROM profiles WHERE user_id = ?`;
		await this.db.runAsync(query, [user_id]);
	}

	/** Search users by username (case-insensitive) */
	async searchUsers(query, limit = 20) {
		try {
			const searchQuery = `%${query}%`;
			const sqlQuery = `
				SELECT 
					p.user_id,
					p.username,
					p.bio,
					p.created_at,
					ph.filename,
					ph.path
				FROM profiles p
				LEFT JOIN photos ph ON p.user_id = ph.user_id
				WHERE LOWER(p.username) LIKE LOWER(?)
				ORDER BY p.username ASC
				LIMIT ?
			`;
			const result = await this.db.allAsync(sqlQuery, [searchQuery, limit]);
			return result.map(row => ({
				user_id: row.user_id,
				username: row.username,
				bio: row.bio,
				created_at: row.created_at,
				photo: row.filename ? {
					filename: row.filename,
					path: row.path,
					is_default: false
				} : {
					filename: 'avatar.jpg',
					path: '/assets/avatar.jpg',
					uploaded_at: null,
					is_default: true
				}
			}));
		} catch (error) {
			console.error('Error searching users:', error);
			throw new Error('Failed to search users');
		}
	}

	/** Get user profile with photo by user_id */
	async getProfileWithPhoto(userId) {
		try {
			const result = await this.db.getAsync(`
			SELECT 
				p.user_id,
				p.username,
				p.bio,
				p.created_at,
				ph.filename,
				ph.path,
				ph.uploaded_at
			FROM profiles p
			LEFT JOIN photos ph ON p.user_id = ph.user_id
			WHERE p.user_id = ?
			`, [userId]);
			if (!result) {
				return null;
			}
			return {
				user_id: result.user_id,
				username: result.username,
				bio: result.bio,
				created_at: result.created_at,
				photo: result.filename ? {
					filename: result.filename,
					path: result.path,
					uploaded_at: result.uploaded_at,
					is_default: false
				} : {
					filename: 'avatar.jpg',
					path: '/assets/avatar.jpg',
					uploaded_at: null,
					is_default: true
				}
			};
		} catch (error) {
			console.error('Error getting profile with photo:', error);
			throw new Error('Failed to get user profile');
		}
	}

	/** Batch get user profiles with photos */
	async getProfilesWithPhotos(userIds) {
		try {
			if (!userIds || userIds.length === 0) {
				return [];
			}
			/** Create placeholders for SQLite (?, ?, ?) */
			const placeholders = userIds.map(() => '?').join(',');
			const result = await this.db.allAsync(`
			SELECT 
				p.user_id,
				p.username,
				p.bio,
				p.created_at,
				ph.filename,
				ph.path,
				ph.uploaded_at
			FROM profiles p
			LEFT JOIN photos ph ON p.user_id = ph.user_id
			WHERE p.user_id IN (${placeholders})
			ORDER BY p.username ASC
			`, userIds);

			return result.map(row => ({
				user_id: row.user_id,
				username: row.username,
				bio: row.bio,
				created_at: row.created_at,
				photo: row.filename ? {
					filename: row.filename,
					path: row.path,
					uploaded_at: row.uploaded_at,
					is_default: false
				} : {
					filename: 'avatar.jpg',
					path: '/assets/avatar.jpg',
					uploaded_at: null,
					is_default: true
				}
			}));
		} catch (error) {
			console.error('Error getting profiles with photos:', error);
			throw new Error('Failed to get user profiles');
		}
	}

  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}