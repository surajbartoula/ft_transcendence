import Database from 'better-sqlite3';

const db = new Database('./app/data/users.db');

/**
 * Create User table if it doesnot exist
 */

db.prepare(`
	CREATE TABLE IF NOT EXISTS users (
		email TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		twoFA INTEGER DEFAULT 0,
		secret TEXT
	)
`).run();

/**
 * Utility functions
 */

export function getUserByEmail(email) {
	return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function createUser({email, name}) {
	db.prepare('INSERT INTO users (email, name) VALUES (?, ?)').run(email, name);
	return getUserByEmail(email);
}
export function updateUserSecret(email, secret) {
	db.prepare('UPDATE users SET secret = ? WHERE email = ?').run(secret, email);
}
export function enable2FA(email) {
	db.prepare('UPDATE users SET twoFA = 1 WHERE email = ?').run(email);
}
