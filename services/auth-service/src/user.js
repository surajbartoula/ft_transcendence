import bcrypt from 'bcryptjs';
import { db } from './db.js';

export class User {
	static async create(email, password, name) {
		const hasedPassword = await bcrypt.hash(password, 10);
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				INSERT INTO users (email, password, name, two_factor_enabled, two_factor_secret)
				VALUES (?, ?, ?, ?, ?)
			`);
			stmt.run([email, hasedPassword, name, 0, null], function(err) {
				if (err) {
					reject(err);
				} else {
					resolve({ id: this.lastID, email, name, two_factor_enabled: false });
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
				'SELECT id, email, name, created_at, two_factor_enabled FROM users WHERE id = ?',
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

	/**Generate 2FA secret for a user */
	static async generate2FASecret(userId, email, appName = 'ft_transcendence') {
		const secret = speakeasy.generateSecret({
			name: `${appName} (${email})`,
			issuer: appName,
			length: 32
		});
		//Store the secret in database(temporarily until user confirms setup)
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				UPDATE users
				SET two_factor_temp_secret = ?
				WHERE id = ?
			`);
			stmt.run([secret.base32, userId], function(err) {
				if (err) {
					reject(err);
				} else {
					resolve({
						secret: secret.base32,
						qrCodeUrl: secret.otpauth_url
					});
				}
			});
			stmt.finalize();
		});
	}

	/**Generate QR code for 2FA setup */
	static async generateQRCode(otpauthURL) {
		try {
			const qrCodeDataUrl = await QRCode.toDataURL(otpauthURL);
			return qrCodeDataUrl;
		} catch (error) {
			throw new Error('Failed to generate QR code');
		}
	}

	/**Verify TOTP token */
	static async verifyTOTP(secret, token) {
		return speakeasy.totp.verify({
			secret: secret,
			encoding: 'base32',
			token: token,
			window: 2
		});
	}

	/**Enable 2FA for user after verification */
	static async enable2FA(userId, token) {
		return new Promise((resolve, reject) => {
			db.get(
				'SELECT two_factor_temp_secret FROM users WHERE id = ?',
				[userId],
				(err, row) => {
					if (err) {
						reject(err);
						return;
					}
					if (!row || !row.two_factor_temp_secret) {
						reject(new Error('No 2FA setup in progress'));
						return;
					}
					const isValid = User.verifyTOTP(row.two_factor_temp_secret, token);
					if (isValid) {
						const stmt = db.prepare(`
							UPDATE users
							SET two_factor_enabled = 1,
								two_factor_secret = two_factor_temp_secret,
								two_factor_temp_secret = NULL
							WHERE id = ?
						`);
						stmt.run([userId], function(err) {
							if (err) {
								reject(err);
							} else {
								resolve({ success: true })
							}
						});
						stmt.finalize();
					} else {
						reject(new Error('Invalid verification code'));
					}
				}
			)
		});
	}

	/**Disable 2FA for user */
	static async disable2FA(userId) {
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				UPDATE users
				SET two_factor_enabled = 0,
					two_factor_secret = NULL,
					two_factor_temp_secret = NULL
				WHERE id = ?
			`);
			stmt.run([userId], function(err) {
				if (err) {
					reject(err);
				} else {
					resolve({ success: true })
				}
			});
			stmt.finalize();
		});
	}

	/**Verify 2FA token during login */
	static async verify2FALogin(userId, token) {
		return new Promise((resolve, reject) => {
			db.get(
				'SELECT two_factor_secret FROM users WHERE id = ? AND two_factor_enabled = 1',
				[userId],
				(err, row) => {
					if (err) {
						reject(err);
						return;
					}
					if (!row || !row.two_factor_secret) {
						reject(new Error('2FA not enabled for this user'));
						return;
					}
					const isValid = User.verifyTOTP(row.two_factor_secret, token);
					resolve(isValid);
				}
			);
		});
	}

	/**Check if user has 2FA enabled */
	static async has2FAEnabled(userId) {
		return new Promise((resolve, reject) => {
			db.get(
				'SELECT two_factor_enabled FROM users WHERE id = ?',
				[userId],
				(err, row) => {
					if (err) {
						reject(err);
					} else {
						resolve(row ? Boolean(row.two_factor_enabled): false);
					}
				}
			);
		});
	}
}