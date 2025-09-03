import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import socketio from 'fastify-socket.io';
import { initializeDatabase } from './database.js';
import gameRoutes from './routes.js';
import { setupSocketHandlers } from './socketHandlers.js';
import fs from 'fs';

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Add global error handlers to prevent service crashes
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    // Don't exit - keep the service running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - keep the service running
});

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
        // Initialize database with tournament features
        await initializeDatabase();

        // Register CORS
        await fastify.register(cors, {
            origin: true,
            credentials: true
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
                origin: true,
                credentials: true
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000,
            upgradeTimeout: 30000,
            maxHttpBufferSize: 1e6, // 1MB
            allowEIO3: true // Allow Engine.IO v3 clients
        });

        // Setup Socket.IO handlers with tournament support
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
                version: '2.0.0',
                timestamp: new Date().toISOString(),
                features: [
                    'Tournament System with Seeding',
                    'Bracket Management',
                    'Real-time Announcements',
                    'Advanced Player Statistics',
                    'Live Spectating',
                    'Tournament Chat',
                    'Match History & Analytics'
                ],
                endpoints: {
                    health: '/api/game/health',
                    game_sessions: '/api/game/session',
                    tournaments: '/api/game/tournament',
                    tournament_seeding: '/api/game/tournament/:id/seeding',
                    tournament_announcements: '/api/game/tournament/:id/announcements',
                    invitations: '/api/game/invite',
                    statistics: '/api/game/stats',
                    leaderboard: '/api/game/leaderboard',
                    game_rooms: '/api/game/room/:id/join'
                },
                socket_events: {
                    authentication: ['authenticate', 'authenticated'],
                    game_control: ['join_game_room', 'player_ready', 'paddle_move', 'game_pause', 'game_quit'],
                    tournament: ['join_tournament_room', 'tournament_match_request', 'tournament_bracket_update_request'],
                    communication: ['game_chat', 'tournament_chat', 'game_emote'],
                    updates: ['game_update', 'tournament_match_result', 'tournament_bracket_update']
                }
            };
        });

        // API documentation endpoint
        fastify.get('/api/docs', async (request, reply) => {
            return {
                title: 'Pong Game Service API',
                version: '2.0.0',
                description: 'Complete tournament and game management system for Pong',
                tournament_features: {
                    seeding: {
                        methods: ['random', 'ranking', 'manual'],
                        description: 'Automatic or manual player seeding based on ranking points or custom arrangement'
                    },
                    bracket_management: {
                        types: ['single_elimination', 'double_elimination', 'round_robin'],
                        positioning: 'Automatic bracket position tracking (R1-M1, R2-M3, etc.)',
                        advancement: 'Automatic winner advancement and next round generation'
                    },
                    announcements: {
                        types: ['general', 'match_ready', 'match_result', 'round_complete', 'player_advance', 'elimination', 'tournament_start', 'tournament_end'],
                        targeting: 'Broadcast to all participants or specific players',
                        expiration: 'Automatic cleanup of expired announcements'
                    },
                    real_time: {
                        spectating: 'Live match viewing for tournament participants',
                        chat: 'Tournament-wide and match-specific chat systems',
                        notifications: 'Real-time updates for match results and bracket changes'
                    }
                },
                database_enhancements: {
                    seeding_support: 'Tournament participants now include seed numbers and ranking points',
                    bracket_positioning: 'Tournament matches include bracket position tracking',
                    announcements: 'Dedicated announcement system with targeting and expiration',
                    enhanced_indexing: 'Optimized database indexes for tournament queries'
                }
            };
        });

        // Start server
        const address = await fastify.listen({ 
            port: PORT, 
            host: '0.0.0.0' 
        });
        // console.log(`Pong Game Service running at: ${address}`);

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown with cleanup
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
    process.on(signal, async () => {
        console.log(`Received ${signal}, shutting down gracefully...`);
        try {
            // Close Socket.IO connections
            if (fastify.io) {
                fastify.io.close();
            }
            
            // Close server
            await fastify.close();
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

start();