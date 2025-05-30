import sqlite3 from 'sqlite3';

const sqlite = sqlite3.verbose();

export const db = new sqlite.Database('./auth.db', (err) => {
	if (err) {
		console.err('Error opening database:', err.message);
	} else {
		console.log('Connected to SQLite database');
	}
});

//**Initialize database schema */
export const initDB = () => {
	db.serialize(() => {
		db.run(`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				email TEXT UNIQUE NOT NULL,
				password TEXT NOT NULL,
				name TEXT NOT NULL,
				two_factor_enabled INTEGER DEFAULT 0,
				two_factor_secret TEXT NULL,
				two_factor_temp_secret TEXT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);
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