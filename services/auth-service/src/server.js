import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { initDB } from './db.js';
import authRoutes from './auth.js'
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.SSL_CERT || !process.env.SSL_KEY) {
	console.error('SSL Certificate not found');
	process.exit(1);
}

let sslConfig;
try {
	sslConfig = {
		https: {
			cert: fs.readFileSync(process.env.SSL_CERT),
			key: fs.readFileSync(process.env.SSL_KEY)
		}
	};
} catch (error) {
	console.error('Failed to load SSL certificates:', error.message);
	process.exit(1);
}

const fastify = Fastify({
	logger: {
		level: process.env.LOG_LEVEL || 'info',
		transport: {
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'SYS:standard',
				ignore: 'pid,hostname'
			}
		}
	},
	...sslConfig
});

/** Register CORS */
await fastify.register(cors, {
	origin: true,
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
		console.log('Auth service running on https://localhost:3001');
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};
start();