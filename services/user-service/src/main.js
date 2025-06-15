import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { DatabaseService } from './services/database.js';
import userRoutes from './routes/user.js';
import healthRoutes from './routes/health.js';
import dotenv from 'dotenv';
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

/** Register plugins */
await fastify.register(cors, {
	origin: process.env.CORS_ORIGIN || true,
	credentials: true
});

await fastify.register(jwt, {
	secret: process.env.JWT_SECRET
});

/** Swagger documentation */
await fastify.register(swagger, {
	openapi: {
		openapi: '3.0.0',
		info: {
			title: 'User Service API',
			description: 'User management service for ft_transcendence',
			version: '1.0.0'
		},
		servers: [
			{
				url: `http://localhost:${process.env.PORT || 3002}`,
				description: 'Development server'
			}
		],
		components: {
			securitySchemes: {
				bearerAuth: {
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT'
				}
			}
		},
		security: [
			{
				bearerAuth: []
			}
		],
		tags: [
			{ name: 'user', description: 'User related end-points' },
			{ name: 'health', description: 'Health check end-points' }
		]
	}
});

await fastify.register(swaggerUi, {
	routePrefix: '/docs',
	uiConfig: {
		docExpansion: 'full',
		deepLinking: false
	},
	staticCSP: true,
	transformStaticCSP: (header) => header,
	transformSpecification: (swaggerObject, request, reply) => {
		return swaggerObject;
	},
	transformSpecificationClone: true
});

/** Initialize database */
const db = new DatabaseService();
await db.initialize();

/** Make database available to routes */
fastify.decorate('db', db);

/** JWT verification decorator */
fastify.decorate('authenticate', async function (request, reply) {
	try {
		await request.jwtVerify();
	} catch (err) {
		reply.code(401).send({ error: 'Unauthorized' });
	}
});

/** Register routes */
await fastify.register(healthRoutes);
await fastify.register(userRoutes, { prefix: '/api/user'} );

/** Global error handler */
fastify.setErrorHandler((error, request, reply) => {
	fastify.log.error(error);
	if (error.validation) {
		reply.status(400).send({
			error: 'Validation Error',
			message: error.message,
			details: error.validation
		});
		return;
	}
	if (error.statusCode) {
		reply.status(error.statusCode).send({
			error: error.message
		});
		return;
	}
	reply.status(500).send({
		error: 'Internal Server Error',
		message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
	});
});

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
		fastify.log.info(`API documentation available at http://${host}:${port}/docs`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();