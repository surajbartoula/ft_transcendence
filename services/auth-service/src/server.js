import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { initDB } from './db.js';
import authRoutes from './auth.js'
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fastify = Fastify({
	logger: true
});

/** Register CORS */
await fastify.register(cors, {
	origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
	credentials: true
});

/** Register JWT */
await fastify.register(jwt, {
	secret: process.env.JWT_SECRET
});

initDB();

await fastify.register(authRoutes, { prefix: '/api/auth' });

fastify.get('/health', async (request, reply) => {
	return { status: 'OK', service: 'auth-service' };
});

const start = async () => {


	
	try {
		await fastify.listen({
			port: 3001,
			host: '0.0.0.0'
		});
		console.log('Auth service running on http://localhost:3001');
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};
start();