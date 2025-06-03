import { User } from './user.js'
import { authenticationToken } from './authtoken.js'
import fastifyOAuth2 from '@fastify/oauth2';
import fetch from 'node-fetch';
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default async function authRoutes(fastify, options) {
	/**
	 * Register endpoints
	 */
	fastify.post('/register', async (request, reply) => {
		try {
			/**Extract email, password and name from the request body */
			const { email, password, name } = request.body;
			if (!email || !password || !name) {
				return reply.status(400).send({
					error: 'Email, password, and name are required'
				});
			}
			if (password.length < 6) {
				return reply.status(400).send({
					error: 'Password must be at least 6 characters long'
				});
			}
			/**
			 * Check if user already exists by email
			 */
			const existingUser = await User.findByEmail(email);
			if (existingUser) {
				return reply.status(400).send({
					error: 'User already exists with this email'
				});
			}
			/**
			 * Create new user
			 */
			const user = await User.create(email, password, name);
			/**
			 * Generate JWT token. (reply.jwtSign) is a Fasify plugin method
			 */
			const token = await reply.jwtSign({
				id: user.id,
				email: user.email
			});
			reply.send({
				message: 'User registered successfully',
				token,
				user: {
					id: user.id,
					email: user.email,
					name: user.name
				}
			});
		} catch (error) {
			reply.status(500).send({
				error: 'Internal server error'
			});
		}
	});

	fastify.post('/login', async (request, reply) => {
		try {
			const { email, password } = request.body;
			if (!email || !password) {
				return reply.status(400).send({
					error: 'Email and password are required'
				});
			}
			const user = await User.findByEmail(email);
			if (!user) {
				return reply.status(401).send({
					error: 'Invalid email or password'
				});
			}
			const isValidPassword = await User.verifyPassword(password, user.password);
			if (!isValidPassword) {
				return reply.status(401).send({
					error: 'Invalid email or password'
				});
			}
			const token = await reply.jwtSign({
				id: user.id,
				email: user.email
			});
			reply.send({
				message: 'Login successful',
				token,
				user: {
					id: user.id,
					email: user.email,
					name: user.name
				}
			});
		} catch (error) {
			reply.status(500).send({
				error: 'Internal server error'
			});
		}
	});

	/**
	 * Setup 2FA - Generate QR code
	 */
	fastify.post('/2fa/setup', {
		preHandler: authenticationToken
	}, async (request, reply) => {
		try {
			const userId = request.user.id;
			const user = await User.findById(userId);
			if (!user) {
				return reply.status(404).send({
					error: 'User not found'
				});
			}
			if (user.two_factor_enabled) {
				return reply.status(400).send({
					error: '2FA is already enabled'
				});
			}
			const { secret, qrCodeUrl } = await User.generate2FASecret(userId, user.email);
			const qrCodeDataUrl = await User.generateQRCode(qrCodeUrl);
			reply.send({
				message: '2FA setup initiated',
				qrCode: qrCodeDataUrl,
				manualEntryKey: secret
			});
		} catch (error) {
			reply.status(500).send({
				error: 'Internal server error'
			});
		}
	});

	/**
	 * Verify & enable 2FA
	 */
	fastify.post('/2fa/verify', {
		preHandler: authenticationToken
	}, async (request, reply) => {
		try {
			const { token } = request.body;
			const userId = request.user.id;
			if (!token) {
				return reply.status(400).send({
					error: '2FA token is required'
				});
			}
			await User.enable2FA(userId, token);
			reply.send({
				message: '2FA enabled successfully'
			});
		} catch (error) {
			if (error.message === 'Invalid verification code' || error.message === 'No 2FA setup in progress') {
				return reply.status(400).send({
					error: error.message
				});
			}
			reply.status(500).send({
				error: 'Internal server error'
			});
		}
	});

	/**
	 * Disable 2FA
	 */
	fastify.post('/2fa/disable', {
		preHandler: authenticationToken
	}, async (request, reply) => {
		try {
			const { token, password } = request.body;
			const userId = request.user.id;
			if (!token || !password) {
				return reply.status(400).send({
					error: '2FA token and password are required'
				});
			}
			/**verify password */
			const user = await User.findByEmail(request.user.email);
			const isValidPassword = await User.verifyPassword(password, user.password);
			if (!isValidPassword) {
				return reply.status(401).send({
					error: 'Invalid password'
				});
			}
			/**Verify 2FA token */
			const is2FAValid = await User.verify2FALogin(userId, token);
			if (!is2FAValid) {
				return reply.status(401).send({
					error: 'Invalid 2FA token'
				});
			}
			await User.disable2FA(userId);
			reply.send({
				message: '2FA disabled successfully'
			});
		} catch (error) {
			reply.status(500).send({
				error: 'Internal server error'
			});
		}
	});

	/**
	 * Get 2FA status
	 */
	fastify.get('/2fa/status', {
		preHandler: authenticationToken
	}, async (request, reply) => {
		try {
			const userId = request.user.id;
			const has2FA = await User.has2FAEnabled(userId);
			reply.send({
				two_factor_enabled: has2FA
			});
		} catch (error) {
			reply.status(500).send({
				error: 'Internal server error'
			});
		}
	});

	/**
	 * Protected route - Get user profile
	 * fastify.get(path, [options], handler)
	 */
	fastify.get('/me', {
		preHandler: authenticationToken
	}, async (request, reply) => {
		try {
			const user = await User.findById(request.user.id);
			if (!user) {
				return reply.status(404).send({
					error: 'User not found'
				});
			}
			reply.send({
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					created_at: user.created_at
				}
			});
		} catch (error) {
			reply.status(500).send({
				error: 'Internal server error'
			});
		}
	});

	fastify.post('/logout', {
		preHandler: fastify.authenticate
	}, async (request, reply) => {
		reply.send({
			message: 'Logout successful'
		});
	});

	/**
	 * Google authentication code below
	 */

	/**Register OAuth2 plugin for Google */
	await fastify.register(fastifyOAuth2, {
		name: 'googleOAuth2',
		credentials: {
			client: {
				id: process.env.GOOGLE_CLIENT_ID,
				secret: process.env.GOOGLE_CLIENT_SECRET
			},
			auth: {
				authorizeHost: 'https://accounts.google.com',
				authorizePath: '/o/oauth2/v2/auth',
				tokenHost: 'https://www.googleapis.com',
				tokenPath: '/oauth2/v4/token'
			}
		},
		startRedirectPath: '/google',
		callbackUri: process.env.GOOGLE_REDIRECT_URI,
		scope: ['openid', 'email', 'profile']
	});

	/**Google OAuth callback*/
	/**This handles the response from Google after user consent*/
	fastify.get('/google/callback', async (request, reply) => {
		try {
			const { token } = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
			const googleUserInfo = await fetchGoogleUserInfo(token.access_token);
			if (!googleUserInfo) {
				return reply.status(400).send({
					error: 'Failed to fetch user information from Google'
				});
			}
			let user = await User.findByEmail(googleUserInfo.email);
			if (!user) {
				user = await User.createGoogleUser(
					googleUserInfo.email,
					googleUserInfo.name,
					googleUserInfo.picture,
					googleUserInfo.sub //google user ID
				);
			} else {
				await User.updateGoogleInfo(user.id, googleUserInfo.picture, googleUserInfo.sub);
			}
			const jwtToken = await reply.jwtSign({
				id: user.id,
				email: user.email
			});
			return reply.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${jwtToken}`);
		} catch (error) {
			console.error('Google OAuth callback error:', error);
			return reply.status(500).send({
				error: 'Google authentication failed'
			});
		}
	});

	/**
	 * Link Google account to existing user
	 */
	fastify.post('/google/link', {
		preHandler: authenticationToken
	}, async (request, reply) => {
		try {
			const { googleToken } = request.body;
			const userId = request.user.id;
			if (!googleToken) {
				return reply.status(400).send({
					error: 'Google token is required'
				});
			}
			const googleUserInfo = await fetchGoogleUserInfo(googleToken);
			if (!googleUserInfo) {
				return reply.status(400).send({
					error: 'Invalid Google token'
				});
			}
			const existingGoogleUser = await User.findByGoogleId(googleUserInfo.sub);
			if (existingGoogleUser && existingGoogleUser.id != userId) {
				return reply.status(400).send({
					error: 'This Google account is already linked to another user'
				});
			}
			await User.linkGoogleAccount(userId, googleUserInfo.sub, googleUserInfo.picture);
			reply.send({
				message: 'Google account linked successfully'
			});
		} catch (error) {
			console.log('Google account linking error:', error);
			reply.status(500).send({
				error: 'Failed to link Google account'
			});
		}
	});

	/**Unlink Google account*/
	fastify.post('/google/unlink', {
		preHandler: authenticationToken
	}, async (request, reply) => {
		try {
			const userId = request.user.id;
			const user = await User.findById(userId);
			if (!user.password) {
				return reply.status(400).send({
					error: 'Cannot unlink Google account. Please set a password first.'
				});
			}
			await User.unlinkGoogleAccount(userId);
			reply.send({
				message: 'Google account unlinked successfully'
			});
		} catch (error) {
			console.error('Google account unlinking error:', error);
			reply.status(500).send({
				error: 'Failed to unlink Google account'
			});
		}
	});
}

/**
 * Fetch user information from Google using access token
 */
async function fetchGoogleUserInfo(accessToken) {
	try {
		const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
			headers: {
				'Authorization': `Bearer ${accessToken}`
			}
		});
		if (!response.ok) {
			throw new Error('Failed to fetch user info from Google');
		}
		return await response.json();
	} catch (error) {
		console.error('Error fetching Google user info:', error);
		return null;
	}
}
