import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { db } from './db.js';
import dotenv from 'dotenv'
import path, { resolve } from 'path';
import { fileURLToPath } from 'url';
import { rejects } from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export class User {
	static ENCRYPTION_KEY = (() => {
		if (!process.env.TWO_FA_ENCRYPTION_KEY) {
			throw new Error('TWO_FA_ENCRYPTION_KEY environment variable is required');
		}
		return Buffer.from(process.env.TWO_FA_ENCRYPTION_KEY, 'hex');
	})();

	/** Encrypt 2FA secret using AES-256-GCM */
	static encrypt2FASecret(secret) {
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv('aes-256-gcm', User.ENCRYPTION_KEY, iv);
		let encrypted = cipher.update(secret, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		const authTag = cipher.getAuthTag();
		return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
	}

	/** Decrypt 2FA secret */
	static decrypt2FASecret(encryptedData) {
		const parts = encryptedData.split(':');
		if (parts.length !== 3) {
			throw new Error('Invalid encrypted data format');
		}
		const iv = Buffer.from(parts[0], 'hex');
		const authTag = Buffer.from(parts[1], 'hex');
		const encrypted = parts[2];
		const decipher = crypto.createDecipheriv('aes-256-gcm', User.ENCRYPTION_KEY, iv);
		decipher.setAuthTag(authTag);
		let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
		decrypted += decipher.final('utf-8');
		return decrypted;
	}

	static async create(email, password, name) {
		const hashedPassword = await bcrypt.hash(password, 10);
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				INSERT INTO users (email, password, name, two_factor_enabled, two_factor_secret, two_factor_temp_secret)
				VALUES (?, ?, ?, ?, ?, ?)
			`);
			stmt.run([email, hashedPassword, name, 0, null, null], function(err) {
				if (err) reject(err);
				else resolve({ id: this.lastID, email, name, two_factor_enabled: false });
			});
			stmt.finalize();
		});
	}

	static async findByEmail(email) {
		return new Promise((resolve, reject) => {
			db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
				if (err) reject(err);
				else resolve(row);
			});
		});
	}

	static async findById(id) {
		return new Promise((resolve, reject) => {
			db.get('SELECT id, email, name, picture, google_id, created_at, two_factor_enabled FROM users WHERE id = ?', [id], (err, row) => {
				if (err) reject(err);
				else resolve(row);
			});
		});
	}

	static async verifyPassword(plainPassword, hashedPassword) {
		return await bcrypt.compare(plainPassword, hashedPassword);
	}

	/** Generate 2FA secret for a user */
	static async generate2FASecret(userId, email, appName = 'ft_transcendence') {
		const secret = speakeasy.generateSecret({
			name: `${appName} (${email})`,
			issuer: appName,
			length: 32
		});
		const encryptedSecret = User.encrypt2FASecret(secret.base32);

		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				UPDATE users
				SET two_factor_temp_secret = ?
				WHERE id = ?
			`);
			stmt.run([encryptedSecret, userId], function(err) {
				if (err) reject(err);
				else resolve({
					secret: secret.base32,
					qrCodeUrl: secret.otpauth_url
				});
			});
			stmt.finalize();
		});
	}

	/** Generate QR code for 2FA setup */
	static async generateQRCode(otpauthURL) {
		try {
			return await QRCode.toDataURL(otpauthURL);
		} catch {
			throw new Error('Failed to generate QR code');
		}
	}

	/** Verify TOTP token */
	static async verifyTOTP(secret, token) {
		return speakeasy.totp.verify({
			secret,
			encoding: 'base32',
			token,
			window: 2
		});
	}

	/** Enable 2FA for user after verification */
	static async enable2FA(userId, token) {
		return new Promise((resolve, reject) => {
			db.get('SELECT two_factor_temp_secret FROM users WHERE id = ?', [userId], async (err, row) => {
				if (err) return reject(err);
				if (!row || !row.two_factor_temp_secret)
					return reject(new Error('No 2FA setup in progress'));

				try {
					const decryptedTempSecret = User.decrypt2FASecret(row.two_factor_temp_secret);
					const isValid = await User.verifyTOTP(decryptedTempSecret, token);

					if (!isValid)
						return reject(new Error('Invalid verification code'));

					const stmt = db.prepare(`
						UPDATE users
						SET two_factor_enabled = 1,
							two_factor_secret = ?,
							two_factor_temp_secret = NULL
						WHERE id = ?
					`);
					stmt.run([row.two_factor_temp_secret, userId], function(err) {
						if (err) reject(err);
						else resolve({ success: true });
					});
					stmt.finalize();
				} catch {
					reject(new Error('Failed to decrypt 2FA secret'));
				}
			});
		});
	}

	/** Disable 2FA for user */
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
				if (err) reject(err);
				else resolve({ success: true });
			});
			stmt.finalize();
		});
	}

	/** Verify 2FA token during login */
	static async verify2FALogin(userId, token) {
		return new Promise((resolve, reject) => {
			db.get('SELECT two_factor_secret FROM users WHERE id = ? AND two_factor_enabled = 1', [userId], (err, row) => {
				if (err) return reject(err);
				if (!row || !row.two_factor_secret)
					return reject(new Error('2FA not enabled for this user'));

				try {
					const decryptedSecret = User.decrypt2FASecret(row.two_factor_secret);
					const isValid = User.verifyTOTP(decryptedSecret, token);
					resolve(isValid);
				} catch {
					reject(new Error('Failed to decrypt 2FA secret'));
				}
			});
		});
	}

	/** Check if user has 2FA enabled */
	static async has2FAEnabled(userId) {
		return new Promise((resolve, reject) => {
			db.get('SELECT two_factor_enabled FROM users WHERE id = ?', [userId], (err, row) => {
				if (err) reject(err);
				else resolve(Boolean(row?.two_factor_enabled));
			});
		});
	}

	/**Create user with Google OAuth */
	static async createGoogleUser(email, name, picture, googleId) {
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				INSERT INTO users (email, name, google_id, picture, password, two_factor_enabled, two_factor_secret, two_factor_temp_secret)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`)
			stmt.run([email, name, googleId, picture, null, 0, null, null], function(err) {
				if (err) reject(err);
				else resolve({
					id: this.lastID,
					email,
					name,
					picture,
					googleId: googleId,
					two_factor_enabled: false
				});
			});
			stmt.finalize();
		});
	}

	/**Find user by google ID */
	static async findByGoogleId(googleId) {
		return new Promise((resolve, reject) => {
			db.get('SELECT * FROM users WHERE google_id = ?', [googleId], (err, row) => {
				if (err) reject(err);
				else resolve(row);
			});
		});
	}

	/**Update user's Google information*/
	static async updateGoogleInfo(userId, picture, googleId) {
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				UPDATE users
				SET picture = ?, google_id = ?
				WHERE id = ?
			`);
			stmt.run([picture, googleId, userId], function(err) {
				if (err) reject(err);
				else resolve({ success: true });
			});
			stmt.finalize();
		});
	}

	static async linkGoogleAccount(userId, googleId, picture) {
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				UPDATE users
				SET google_id = ?, picture = ?
				WHERE id = ?
			`);
			stmt.run([googleId, picture, userId], function(err) {
				if (err) reject(err);
				else resolve({success: true});
			});
			stmt.finalize();
		});
	}

	static async unlinkGoogleAccount(userId) {
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				UPDATE users
				SET google_id = NULL, picture = NULL
				WHERE id = ?
			`);
			stmt.run([userId], function(err) {
				if (err) reject(err);
				else resolve({success: true});
			});
			stmt.finalize();
		});
	}

	/**Check if user has Google account linked*/
	static async hasGoogleLinked(userId) {
		return new Promise((resolve, reject) => {
			db.get('SELECT google_id FROM users WHERE id = ?', [userId], (err, row) => {
				if (err) reject(err);
				else resolve(Boolean(row?.google_id));
			});
		});
	}
}