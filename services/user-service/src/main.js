import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { DatabaseService } from './services/database.js';
import userRoutes from './routes/user.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fastify = Fastify({
	logger: {
		level: process.env.LOG_LEVEL || 'info'
	}
});

const uploadDir = process.env.DOCKER_ENV ? '/app/uploads' : path.join(__dirname, 'uploads');
await fs.promises.mkdir(uploadDir, { recursive: true });

/** Register plugins */
await fastify.register(cors, {
	origin: process.env.CORS_ORIGIN || true,
	credentials: true
});

await fastify.register(jwt, {
	secret: process.env.JWT_SECRET
});

await fastify.register(fastifyMultipart);

/** Initialize database */
const db = new DatabaseService();
await db.initialize();

/** Make database and uploadDir available to routes */
fastify.decorate('db', db);
fastify.decorate('uploadDir', uploadDir);

/** JWT verification decorator */
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
    
    // Add debug logging
    request.log.info('Authentication successful:', {
      user_id: request.user.sub || request.user.user_id || request.user.id,
      user: request.user
    });
    
  } catch (err) {
    request.log.error('Authentication failed:', err.message);
    reply.code(401).send({ error: 'Unauthorized', details: err.message });
  }
});

/** Register routes */
await fastify.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/'
});
await fastify.register(userRoutes, { prefix: '/api/user'} );
console.log(fastify.printRoutes());

/** Gracefully shutdown */
const gracefulShutdown = async () => {
	fastify.log.info('Shutting down gracefully...');
	try {
		await db.close();
		await fastify.close();
		process.exit(0);
	} catch (err) {
		fastify.log.error('Error during shutdown:', err);
		process.exit(1);
	}
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

/** Start Server */
const start = async () => {
	try {
		const port = process.env.PORT || 3002;
		const host = process.env.HOST || '0.0.0.0';
		await fastify.listen({ port: parseInt(port), host });
		fastify.log.info(`User service listening on http://${host}:${port}`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();