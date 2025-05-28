import bcrypt from 'bcryptjs';
import { db } from './db.js';

export class User {
	static async create(email, password, name) {
		const hasedPassword = await bcrypt.hash(password, 10);
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				INSERT INTO users (email, password, name)
				VALUES (?, ?, ?)
			`);
			stmt.run([email, hasedPassword, name], function(err) {
				if (err) {
					reject(err);
				} else {
					resolve({ id: this.lastID, email, name });
				}
			});
			stmt.finalize();
		});
	}

	static async findByEmail(email) {
		return new Promise((resolve, reject) => {
			db.get(
				'SELECT * FROM users WHERE email = ?',
				[email],
				(err, row) => {
					if (err) {
						reject(err);
					} else {
						resolve(row);
					}
				}
			)
		});
	}

	static async findById(id) {
		return new Promise((resolve, reject) => {
			db.get(
				'SELECT id, email, name, created_at FROM users WHERE id = ?',
				[id],
				(err, row) => {
					if (err) {
						reject(err);
					} else {
						resolve(row);
					}
				}
			)
		})
	}

	static async verifyPassword(plainPassword, hasedPassword) {
		return await bcrypt.compare(plainPassword, hasedPassword);
	}
}