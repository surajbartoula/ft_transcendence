import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import path, { join } from 'path';
import dotenv from 'dotenv';

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
run: executes a SQL statement (e.g., INSERT, UPDATE). run() returns an object with metadata (like lastID, changes)
get: fetches a single row.
all: fetches all rows.
 */

export class Database {
	constructor() {
		const dbPath =this.getDatabasePath();
		this.db = new sqlite3.Database(dbPath);
		console.log('Connected chat.db at:', dbPath);
		/** Promisify database methods */
		this.run = promisify(this.db.run.bind(this.db));
		this.get = promisify(this.db.get.bind(this.db));
		this.all = promisify(this.db.all.bind(this.db));
	}

	getDatabasePath() {
		const isDocker = process.env.DOCKER_ENV || fs.existsSync('/app');
		if (isDocker) {
			const dataDir = '/app/data';
			if (!fs.existsSync(dataDir)) {
				fs.mkdirSync(dataDir, { recursive: true });
			}
			return join(dataDir, 'chat.db');
		}
		return process.env.DATABASE_PATH || join(__dirname, '../chat.db');
	}

	/** PRIMARY KEY cannot have null value but UNIQUE can have null value */
	/** PRIMARY KEY can be only 1 on a table */
	async init() {
		await this.run(`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				username TEXT UNIQUE NOT NULL,
				email TEXT UNIQUE NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);

		await this.run(`
			CREATE TABLE IF NOT EXISTS messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				sender_id INTEGER NOT NULL,
				recipient_id INTEGER NOT NULL,
				content TEXT NOT NULL,
				type TEXT DEFAULT 'text',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				read_at DATETIME,
				FOREIGN KEY (sender_id) REFERENCES users(id),
				FOREIGN KEY (recipient_id) REFERENCES users(id)
			)
		`);

		await this.run(`
			CREATE TABLE IF NOT EXISTS blocked_users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				blocked_user_id INTEGER NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(user_id, blocked_user_id),
				FOREIGN KEY (user_id) REFERENCES users(id),
				FOREIGN KEY (blocked_user_id) REFERENCES users(id)
     	 	)
		`);

		await this.run(`
			CREATE TABLE IF NOT EXISTS game_invites (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				sender_id INTEGER NOT NULL,
				recipient_id INTEGER NOT NULL,
				status TEXT DEFAULT 'pending',
				game_room_id TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				expires_at DATETIME,
				FOREIGN KEY (sender_id) REFERENCES users(id),
				FOREIGN KEY (recipient_id) REFERENCES users(id)
			)
		`);

		await this.run(`
	      	CREATE TABLE IF NOT EXISTS tournament_notifications (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tournament_id INTEGER NOT NULL,
				user_id INTEGER NOT NULL,
				message TEXT NOT NULL,
				type TEXT NOT NULL,
				read BOOLEAN DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id)
			)
		`);

		await this.run(`CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(sender_id, recipient_id)`);
		await this.run(`CREATE INDEX IF NOT EXISTS idx_blocked_users ON blocked_users(user_id, blocked_user_id)`);
	}

	/**
	 * MESSAGE METHODS
	 */

	async saveMessage(senderId, recipientId, content, type = 'text') {
		const result = await this.run(
		    'INSERT INTO messages (sender_id, recipient_id, content, type) VALUES (?, ?, ?, ?)',
      		[senderId, recipientId, content, type]
		);
		return this.get('SELECT * FROM messages WHERE id = ?', [result.lastID]);
	}

	async getMessages(userId1, userId2, limit = 50) {
		return this.all(
			`SELECT * FROM messages 
			WHERE (sender_id = ? AND recipient_id = ?) 
			OR (sender_id = ? AND recipient_id = ?)
			ORDER BY created_at DESC LIMIT ?`,
			[userId1, userId2, userId2, userId1, limit]
		);
	}

	async markAsRead(messageId, userId) {
		return this.run(
      		'UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_id = ?',
      		[messageId, userId]
		);
	}

	/**
	 * BLOCK METHODS
	 */

	async isBlocked(userId, blockedUserId) {
		const result = await this.get(
      		'SELECT id FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
      		[userId, blockedUserId]
		);
		return !!result;
	}

	async blockUser(userId, blockedUserId) {
		return this.run(
      		'INSERT OR IGNORE INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)',
      		[userId, blockedUserId]
		);
	}

	async unblockUser(userId, blockedUserId) {
		return this.run(
      		'DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
      		[userId, blockedUserId]
		);
	}

	async getBlockedUsers(userId) {
		return this.all(
			`SELECT u.id, u.username, b.created_at 
			FROM blocked_users b 
			JOIN users u ON b.blocked_user_id = u.id 
			WHERE b.user_id = ?`,
      		[userId]
		);
	}

	/**
	 * GAME INVITE METHODS
	 */

	async createGameInvite(senderId, recipientId) {
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
		const result = await this.run(
			'INSERT INTO game_invites (sender_id, recipient_id, expires_at) VALUES (?, ?, ?)',
			[senderId, recipientId, expiresAt.toISOString()]
		);
		return this.get('SELECT * FROM game_invites WHERE id = ?', [result.lastID]);
	}

	async updateInviteStatus(inviteId, status, gameRoomId = null) {
		return this.run(
			'UPDATE game_invites SET status = ?, game_room_id = ? WHERE id = ?',
			[status, gameRoomId, inviteId]
		);
	}

	async getInvite(inviteId) {
		return this.get('SELECT * FROM game_invites WHERE id = ?', [inviteId]);
	}

	async getPendingInvites(userId) {
		return this.all(
			`SELECT g.*, u.username as sender_username 
			FROM game_invites g 
			JOIN users u ON g.sender_id = u.id 
			WHERE g.recipient_id = ? AND g.status = 'pending' AND g.expires_at > datetime('now')`,
			[userId]
		);
	}

	/**
	 * TOURNAMENT NOTIFICATIONS METHODS
	 */

	async createNotification(tournamentId, userId, message, type) {
		const result = await this.run(
			'INSERT INTO tournament_notifications (tournament_id, user_id, message, type) VALUES (?, ?, ?, ?)',
			[tournamentId, userId, message, type]
		);
		return result.lastID;
	}

	async getNotifications(userId) {
		return this.all(
			'SELECT * FROM tournament_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
			[userId]
		);
	}

	async markNotificationRead(notificationId, userId) {
		return this.run(
			'UPDATE tournament_notifications SET read = 1 WHERE id = ? AND user_id = ?',
			[notificationId, userId]
		);
	}

	/**
	 * USER METHODS
	 */

	async getUser(userId) {
		return this.get('SELECT id, username FROM users WHERE id = ?', [userId]);
	}
}