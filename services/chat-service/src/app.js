import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fastifySocketIO from 'fastify-socket.io';
import fs from 'fs';

import { initDatabase, closeDatabase } from './database.js';
import { registerRoutes } from './routes.js';
import { setupSocketHandlers } from './socketHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://localhost:3000';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://localhost:3000';

if (!process.env.SSL_CERT || !process.env.SSL_KEY) {
	console.error('SSL_CERT & SSL_KEY not found');
	process.exit(1);
}

let httpsOptions;
try {
	if (!fs.existsSync(process.env.SSL_CERT) || !fs.existsSync(process.env.SSL_KEY)) {
		console.error('SSL certifcate files not found');
		process.exit(1);
	}
	httpsOptions = {
		key: fs.readFileSync(process.env.SSL_KEY),
		cert: fs.readFileSync(process.env.SSL_CERT)
	}
} catch (error) {
	console.error('Error reading SSL certificates:', error.message);
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
	https: httpsOptions
});

async function setupFastify() {

	await fastify.register(cors, {
		origin: true,
		credentials: true
	});

	await fastify.register(jwt, { 
		secret: JWT_SECRET
	});

	await fastify.register(fastifySocketIO, {
		cors: {
			origin: true,
			credentials: true
		}
	});

	registerRoutes(fastify);

	setupSocketHandlers(fastify);
}

async function start() {
	try {
	await initDatabase();
	await setupFastify();
	await fastify.listen({ port: PORT, host: '0.0.0.0' });
	// console.log(`Chat service running on port ${PORT}`);
	} catch (err) {
	fastify.log.error(err);
	process.exit(1);
	}
}

async function gracefulShutdown(signal) {
	console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
	const timeout = setTimeout(() => {
		process.exit(1);
	}, 2000);
	try {
		if (fastify.io) {
			fastify.io.close();
		}
		await fastify.close();
		await closeDatabase();
		clearTimeout(timeout);
		console.log('Server closed successfully');
		process.exit(0);
	} catch (err) {
		console.error('Error during graceful shutdown:', err);
		process.exit(1);
	}
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();