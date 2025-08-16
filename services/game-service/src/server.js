import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import socketio from 'fastify-socket.io';
import { initializeDatabase } from './database.js';
import gameRoutes from './routes.js';
import { setupSocketHandlers } from './socketHandlers.js';
import fs from 'fs';

if (!process.env.SSL_CERT || !process.env.SSL_KEY) {
	console.error('SSL_CERT and SSL_KEY environment variables are required');
	process.exit(1);
}

let httpsOptions;
try {
	if (!fs.existsSync(process.env.SSL_CERT) || !fs.existsSync(process.env.SSL_KEY)) {
		console.error('SSL certificate files not found!');
		console.error(`SSL_CERT: ${process.env.SSL_CERT}`);
		console.error(`SSL_KEY: ${process.env.SSL_KEY}`);
		process.exit(1);
	}
	
	httpsOptions = {
		key: fs.readFileSync(process.env.SSL_KEY),
		cert: fs.readFileSync(process.env.SSL_CERT)
	};
	
	console.log('HTTPS configuration loaded for game service');
} catch (error) {
	console.error('Error reading SSL certificates:', error.message);
	process.exit(1);
}

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  },
  https: httpsOptions
});

const PORT = process.env.PORT || 3004;
const JWT_SECRET = process.env.JWT_SECRET;
const CORS_ORIGIN = process.env.CORS_ORIGIN;

async function start() {
    try {
        // Initialize database
        console.log('🎮 Initializing Pong Game Service...');
        await initializeDatabase();

        // Register CORS
        await fastify.register(cors, {
            origin: CORS_ORIGIN,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
        });

        // Register JWT
        await fastify.register(jwt, {
            secret: JWT_SECRET,
            sign: {
                expiresIn: '24h'
            }
        });

        // Register Socket.IO
        await fastify.register(socketio, {
            cors: {
                origin: CORS_ORIGIN,
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        // Setup Socket.IO handlers
        setupSocketHandlers(fastify.io);

        // Register routes
        await fastify.register(gameRoutes);

        // Global error handler
        fastify.setErrorHandler((error, request, reply) => {
            request.log.error(error);
            
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
                    error: error.message || 'An error occurred'
                });
                return;
            }

            reply.status(500).send({
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        });

        // Health check endpoint
        fastify.get('/', async (request, reply) => {
            return {
                service: 'Pong Game Service',
                status: 'healthy',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                endpoints: {
                    health: '/api/health',
                    game_sessions: '/api/game/session',
                    tournaments: '/api/tournament',
                    invitations: '/api/game/invite',
                    statistics: '/api/stats',
                    leaderboard: '/api/leaderboard'
                }
            };
        });

        // Start server
        const address = await fastify.listen({ 
            port: PORT, 
            host: '0.0.0.0' 
        });

        console.log(`🚀 Pong Game Service running at: ${address}`);
        console.log(`🔌 Socket.IO enabled for real-time gameplay`);
        console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);

    } catch (error) {
        console.error('💥 Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
    process.on(signal, async () => {
        console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
        try {
            await fastify.close();
            console.log('✅ Server closed successfully');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

start();