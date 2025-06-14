import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import jwt from '@fastify/jwt';
import { WebSocketHandler } from './websockethandler.js';
import { Database } from './db.js';
import { ChatRoutes } from './chat.js';
import { UserRoutes } from './user.js'
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fastify = Fastify({
	logger: true,
});

const PORT = process.env.PORT;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL

await fastify.register(cors, {
	origin: FRONTEND_URL,
	credentials: true
});

await fastify.register(websocket);

await fastify.register(jwt, {
	secret: JWT_SECRET
});

const db = new Database();
await db.init();

const wsHandler = new WebSocketHandler(db);

/** Authentication middleware */
async function authenticate(request, reply) {
	try {
		await request.jwtVerify();
	} catch (err) {
		reply.code(401).send({ error: 'Unathorized' });
	}
}

/** WebSocket endpoint */
fastify.register(async function (fastify) {
	fastify.get('/ws', { websocket: true }, async (connection, req) => {
		const token = req.query.token;
		if (!token) {
			connection.socket.close(1008, 'No token provided');
			return;
		}
		try {
			const decoded = fastify.jwt.verify(token);
			const userId = decoded.userId;
			await wsHandler.handleConnection(connection, userId);
		} catch (error) {
			fastify.log.error('WebSocket auth error:', error);
			connection.socket.close(1008, 'Invalid token');
		}
	});
});

await fastify.register(ChatRoutes, {
	prefix: '/api/chat',
	authenticate,
	db
});

await fastify.register(UserRoutes, {
	prefix: '/api/user',
	authenticate,
	db
});

fastify.get('/health', async (request, reply) => {
	return { status: 'ok', service: 'chat-service' };
});

const start = () => {
	try {
		fastify.listen({
			port: PORT,
			host: '0.0.0.0'
		});
		fastify.log.info(`Chat service running on port ${PORT}`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();