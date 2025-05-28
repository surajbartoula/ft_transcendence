import { User } from './user.js'
import { authenticationToken } from './authtoken.js'

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
}