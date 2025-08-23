import sqlite3 from 'sqlite3';
import fs from 'fs';
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sqlite = sqlite3.verbose();

const getDatabasePath = () => {
	const isDocker = process.env.DOCKER_ENV || fs.existsSync('/app');
	if (isDocker) {
		const dataDir = '/app/data';
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}
		return path.join(dataDir, 'auth.db');
	} else {
		return './auth.db';
	}
};

const dbPath = getDatabasePath();

export const db = new sqlite3.Database(dbPath, (err) => {
	if (err) {
		console.error('Error opening database:', err.message);
		process.exit(1);
	} else {
		console.log('Connected auth.db at:', dbPath);
	}
});

//**Initialize database schema */
export const initDB = () => {
	db.serialize(() => {
		db.run(`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				email TEXT UNIQUE NOT NULL,
				password TEXT NULL,
				name TEXT NOT NULL,
				picture TEXT NULL,
				google_id TEXT UNIQUE NULL,
				two_factor_enabled INTEGER DEFAULT 0,
				two_factor_secret TEXT NULL,
				two_factor_temp_secret TEXT NULL,
				email_verified INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);
		db.run(`
			CREATE TABLE IF NOT EXISTS email_verification_codes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				email TEXT NOT NULL,
				code TEXT NOT NULL,
				expires_at DATETIME NOT NULL,
				used INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (email) REFERENCES users(email)
			)
		`);
		db.run(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`);
		db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
		db.run(`CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON email_verification_codes(email)`);
		db.run(`CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON email_verification_codes(code)`);
		console.log('Database schema initialized successfully');
	});
};

//**Gracefully shutdown*/
process.on('SIGINT', () => {
	db.close((err) => {
		if (err) {
			console.error(err.message);
		} else {
			console.log('Database connection closed');
		}
		process.exit(0);
	});
});