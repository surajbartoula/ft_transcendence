import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

class EmailService {
	constructor() {
		this.transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: process.env.GMAIL_USER,
				pass: process.env.GMAIL_APP_PASSWORD
			}
		});
	}

	async sendVerificationEmail(email, verificationCode, name) {
		const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?code=${verificationCode}&email=${encodeURIComponent(email)}`;
		const mailOptions = {
			from: process.env.GMAIL_USER,
			to: email,
			subject: 'Verify your Email Address',
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #333;">Welcome ${name}!</h2>
					<p>Thank you for registering. Please verify your email address to complete your registration.</p>
					<p>Your verification code is: <strong style="font-size: 24px; color: #007bff;">${verificationCode}</strong></p>
					<p style="margin-top: 20px; color: #666; font-size: 12px;">This code will expire in 24 hours.</p>
					<p style="color: #666; font-size: 12px;">If you didn't create an account, please ignore this email.</p>
				</div>
			`
		};
		try {
			await this.transporter.sendMail(mailOptions);
			console.log('Verification email send to:', email);
			return true;
		} catch (error) {
			console.error('Error sending email:', error);
			return false;
		}
	}

	generateVerificationCode() {
		return crypto.randomBytes(3).toString('hex').toUpperCase();
	}
}

export const emailService = new EmailService();