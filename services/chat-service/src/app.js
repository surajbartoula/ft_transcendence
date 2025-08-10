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

const sslKeyPath = '/app/ssl/key.pem';
const sslCertPath = '/app/ssl/cert.pem';

let httpsOptions = null;

try {
	if (!fs.existsSync(sslKeyPath) || !fs.existsSync(sslCertPath)) {
		console.error('SSL certificates not found!');
		process.exit(1);
	}
	httpsOptions = {
		key: fs.readFileSync(sslKeyPath),
		cert: fs.readFileSync(sslCertPath)
	}
} catch (error) {
	console.error('Error reading SSL certificates:', error.message);
	process.exit(1);
}

const fastify = Fastify({ 
	logger: true,
	https: httpsOptions
});

async function setupFastify() {

	await fastify.register(cors, {
		origin: CORS_ORIGIN,
		credentials: true
	});

	await fastify.register(jwt, { 
		secret: JWT_SECRET
	});

	await fastify.register(fastifySocketIO, {
		cors: {
			origin: CORS_ORIGIN,
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
	console.log(`Chat service running on port ${PORT}`);
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