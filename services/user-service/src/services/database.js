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

    // FIXED: Removed duplicate PRIMARY KEY declaration
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

    // Create index for better performance
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
		// FIXED: Changed 'err' to 'error' to match the catch parameter
		if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
			throw new Error('Profile already exists for this user');
		}
		throw error;
	}
  }

  async updateProfile(user_id, updates) {
    // Build dynamic SET clause and values array
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
      // Nothing to update
      return this.getProfile(user_id);
    }

    values.push(user_id); // For WHERE clause

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

  async getProfileWithPhoto(user_id) {
    const query = `
      SELECT p.*, ph.filename, ph.path, ph.uploaded_at
      FROM profiles p
      LEFT JOIN photos ph ON p.user_id = ph.user_id
      WHERE p.user_id = ?
    `;
    return await this.db.getAsync(query, [user_id]);
  }

  async listProfiles() {
    return await this.db.allAsync(`SELECT * FROM profiles`);
  }

  // Photos - FIXED: Updated to handle the new schema properly

  async addOrUpdatePhoto({ user_id, filename, path }) {
    try {
      // First, try to get existing photo
      const existingPhoto = await this.getPhoto(user_id);
      
      if (existingPhoto) {
        // Update existing photo
        const query = `
          UPDATE photos 
          SET filename = ?, path = ?, uploaded_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `;
        await this.db.runAsync(query, [filename, path, user_id]);
      } else {
        // Insert new photo
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