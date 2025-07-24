import Fastify from 'fastify';
import cors from '@fastify/cors';
import socketioServer from 'fastify-socket.io';
import jwt from '@fastify/jwt';
import { Database } from './database.js';
import { SocketManager } from './socket.js';
import { setupRoutes } from './routes.js';
import { setupSocketHandlers } from './handlers.js';
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;
const CORS_ORIGIN = process.env.CORS_ORIGIN;

async function start() {
	const fastify = Fastify({
		logger: true
	});
	/** Initialize database */
	const db = new Database();
	await db.init();
	/** Register plugins */
	await fastify.register(cors, { origin: CORS_ORIGIN, credentials: true});
	await fastify.register(jwt, { secret: JWT_SECRET });
	await fastify.register(socketioServer, {
		cors: { origin: CORS_ORIGIN, credentials: true }
	});
	/** Initialize socketManager */
	const socketManager = new SocketManager();
	/** Decorators */
	fastify.decorate('db', db);
	fastify.decorate('socketManager', socketManager);
	fastify.decorate('authenticate', async function(request, reply) {
		try {
			await request.jwtVerify();
		} catch (err) {
			reply.code(401).send({ error: 'Unauthorized' });
		}
	});

	await fastify.register(async function(fastify) {
		setupRoutes(fastify);
	}, { prefix: '/api/chat'});

	setupSocketHandlers(fastify.io, socketManager, db);

	fastify.get('/health', async () => ({status: 'ok'}));
	/** Print all routes for debuggin */
	console.log(fastify.printRoutes());
	/** Start server */
	try {
		await fastify.listen({ port: PORT, host: '0.0.0.0'});
		console.log(`Server running on port ${PORT}`);
	} catch (err) {
		console.error('Error starting server:', err);
		process.exit(1);
	}
}

start();