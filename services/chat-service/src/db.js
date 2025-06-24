import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sqlite = sqlite3.verbose();

export class Database {
	constructor() {
		this.db = null;
	}

	getDatabasePath() {
		const isDocker = process.env.DOCKER_ENV || fs.existsSync('/app');
		if (isDocker) {
			const dataDir = '/app/data';
			if (!fs.existsSync(dataDir)) {
				fs.mkdirSync(dataDir, { recursive: true });
			}
			return path.join(dataDir, 'chat.db');
		} else {
			return './chat.db';
		}
	}

	async init() {
		return new Promise((resolve, reject) => {
			const dbPath = this.getDatabasePath();
			this.db = new sqlite3.Database(dbPath, (err) => {
				if (err) {
					console.error('Error opening database:', err);
					reject(err);
				} else {
					console.log('Connected to chat.db');
					this.createTables().then(resolve).catch(reject);
				}
			});
		});
	}

	async createTables() {
		const queries = [
		/**Message Table*/
		`CREATE TABLE IF NOT EXISTS messages (
			id TEXT PRIMARY KEY,
			sender_id TEXT NOT NULL,
			recipient_id TEXT,
			room_id TEXT,
			message TEXT NOT NULL,
			message_type TEXT DEFAULT 'text',
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
			is_read BOOLEAN DEFAULT FALSE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		/**Blocked users table */
		`CREATE TABLE IF NOT EXISTS blocked_users (
			id TEXT PRIMARY KEY,
			blocker_id TEXT NOT NULL,
			blocked_id TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(blocker_id, blocked_id)
		)`,
		/**Game invite Table */
		`CREATE TABLE IF NOT EXISTS game_invites (
			id TEXT PRIMARY KEY,
			sender_id TEXT NOT NULL,
			recipient_id TEXT NOT NULL,
			game_type TEXT DEFAULT 'pong',
			status TEXT DEFAULT 'pending',
			expires_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		/**Chat rooms table (for future use)*/
		`CREATE TABLE IF NOT EXISTS chat_rooms (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT DEFAULT 'public',
			created_by TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		/**Room members table*/
		`CREATE TABLE IF NOT EXISTS room_members (
			id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			role TEXT DEFAULT 'member',
			joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(room_id, user_id)
		)`,
		/** Create indexes */
		`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`,
		`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id)`,
		`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id)`,
		`CREATE INDEX IF NOT EXISTS idx_game_invites_recipient ON game_invites(recipient_id)`,
		`CREATE INDEX IF NOT EXISTS idx_game_invites_status ON game_invites(status)`
		];
		for (const query of queries) {
			await this.run(query);
		}
  	}

	/** Promisified database methods */
	run(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.run(sql, params, function(err) {
				if (err) reject(err);
				else resolve({ lastID: this.lastID, changes: this.changes })
			});
		});
	}

	get(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.get(sql, params, (err, row) => {
				if (err) reject(err);
				else resolve(row);
			});
		});
	}

	all(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.all(sql, params, (err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			});
		});
	}

	async saveMessage({ senderId, recipientId, roomId, message, messageType = 'text' }) {
		const id = uuidv4();
		const sql = `
			INSERT INTO messages (id, sender_id, recipient_id, room_id, message, message_type)
			VALUES (?, ?, ?, ?, ?, ?)
		`;
		await this.run(sql, [id, senderId, recipientId, roomId, message, messageType]);
		return await this.get('SELECT * FROM messages WHERE id = ?', [id]);
	}

	async getDirectMessages(userId1, userId2, limit = 50, offset = 0) {
		const sql = `
			SELECT * FROM messages 
			WHERE (sender_id = ? AND recipient_id = ?) 
				OR (sender_id = ? AND recipient_id = ?)
			ORDER BY timestamp DESC
			LIMIT ? OFFSET ?
		`;
		const messages = await this.all(sql, [userId1, userId2, userId2, userId1, limit, offset]);
		return messages.reverse();
	}

	async getRecentChats(userId, limit = 20) {
		const sql = `
			WITH recent_conversations AS (
			SELECT 
				CASE
				WHEN sender_id = ? THEN recipient_id
				ELSE sender_id
				END as other_user_id,
				MAX(timestamp) as last_message_time
			FROM messages
			WHERE sender_id = ? OR recipient_id = ?
			GROUP BY other_user_id
			),
			conversation_details AS (
			SELECT 
				rc.other_user_id,
				rc.last_message_time,
				m.message as last_message,
				(SELECT COUNT(*) FROM messages m3
				WHERE m3.sender_id = rc.other_user_id
				AND m3.recipient_id = ?
				AND m3.is_read = FALSE) as unread_count
			FROM recent_conversations rc
			JOIN messages m ON m.timestamp = rc.last_message_time
				AND ((m.sender_id = ? AND m.recipient_id = rc.other_user_id)
					OR (m.sender_id = rc.other_user_id AND m.recipient_id = ?))
			)
			SELECT DISTINCT * FROM conversation_details
			ORDER BY last_message_time DESC
			LIMIT ?
		`;
		return await this.all(sql, [userId, userId, userId, userId, userId, userId, limit]);
	}

	async markMessagesAsRead(senderId, recipientId) {
		const sql = `
			UPDATE messages 
			SET is_read = TRUE 
			WHERE sender_id = ? AND recipient_id = ? AND is_read = FALSE
		`;
		return await this.run(sql, [senderId, recipientId]);
	}

	async blockUser(blockerId, blockedId) {
		const id = uuidv4();
		const sql = `
			INSERT OR IGNORE INTO blocked_users (id, blocker_id, blocked_id)
			VALUES (?, ?, ?)
		`;
		return await this.run(sql, [id, blockerId, blockedId]);
	}

	async unblockUser(blockerId, blockedId) {
		const sql = `
			DELETE FROM blocked_users 
			WHERE blocker_id = ? AND blocked_id = ?
		`;
		return await this.run(sql, [blockerId, blockedId]);
	}

	async isUserBlocked(blockerId, blockedId) {
		const sql = `
	    	SELECT 1 FROM blocked_users 
      		WHERE blocker_id = ? AND blocked_id = ?
		`;
		const result = await this.get(sql, [blockerId, blockedId]);
		return !!result; /**Boolead true or false if the result exist true, if not false */
	}

	async getBlockedUsers(userId) {
		const sql = `
			SELECT blocked_id, created_at 
			FROM blocked_users 
			WHERE blocker_id = ?
			ORDER BY created_at DESC
		`;
		return await this.all(sql, [userId]);
	}

	async createGameInvite({ senderId, recipientId, gameType = 'pong' }) {
		const id = uuidv4();
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
		const sqliteDateTime = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
		const sql = `
	    	INSERT INTO game_invites (id, sender_id, recipient_id, game_type, expires_at)
      		VALUES (?, ?, ?, ?, ?)
		`;
		await this.run(sql, [id, senderId, recipientId, gameType, sqliteDateTime]);
		return await this.get('SELECT * FROM game_invites WHERE id = ?', [id]);
	}

	async updateGameInviteStatus(inviteId, status) {
		const sql = `
	    	UPDATE game_invites 
    		SET status = ? 
    		WHERE id = ? AND status = 'pending'
		`;
		return await this.run(sql, [status, inviteId]);
	}

	async getGameInvite(inviteId) {
		const sql = `
			SELECT * FROM game_invites 
      		WHERE id = ? AND expires_at > datetime('now')
		`;
		return await this.get(sql, [inviteId]);
	}

	async getPendingGameInvites(userId) {
		const sql = `
	    	SELECT * FROM game_invites 
      		WHERE recipient_id = ? AND status = 'pending' AND expires_at > datetime('now')
      		ORDER BY created_at DESC
		`;
		return await this.all(sql, [userId]);
	}

	async cleanupExpiredInvites() {
		const sql = `
	    	DELETE FROM game_invites 
      		WHERE expires_at < datetime('now')
		`;
		return await this.run(sql);
	}

	async close() {
		return new Promise((resolve) => {
			this.db.close((err) => {
				if (err) console.error('Error closing database:', err);
				else console.log('Database connection closed');
				resolve();
			});
		});
	}
}
