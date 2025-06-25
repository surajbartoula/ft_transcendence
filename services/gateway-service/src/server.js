import Fastify from 'fastify';
import cors from '@fastify/cors';
import httpProxy from '@fastify/http-proxy';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fastify = Fastify({ 
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.LOG_PRETTY === 'true' ? {
            target: 'pino-pretty',
            options: {
                colorize: true
            }
        } : undefined
    },
    trustProxy: process.env.TRUST_PROXY === 'true'
});

const PORT = process.env.PORT || 3005;

// Register CORS plugin
await fastify.register(cors, {
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        process.env.FRONTEND_DOCKER_URL || 'http://frontend:3000'
    ],
    credentials: true
});

// Service endpoints configuration
const services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    user: process.env.USER_SERVICE_URL || 'http://localhost:3002',
    chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3003',
    game: process.env.GAME_SERVICE_URL || 'http://localhost:3004'
};

// Health check endpoint
fastify.get('/health', async (request, reply) => {
    return {
        status: 'healthy',
        service: 'gateway-service',
        timestamp: new Date().toISOString(),
        services: Object.keys(services)
    };
});

// Service health check endpoint
fastify.get('/health/services', async (request, reply) => {
    const healthChecks = await Promise.allSettled(
        Object.entries(services).map(async ([name, url]) => {
            try {
                const response = await fetch(`${url}/health`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000)
                });
                return {
                    service: name,
                    status: response.ok ? 'healthy' : 'unhealthy',
                    url
                };
            } catch (error) {
                return {
                    service: name,
                    status: 'unreachable',
                    url,
                    error: error.message
                };
            }
        })
    );

    const results = healthChecks.map(result => 
        result.status === 'fulfilled' ? result.value : {
            service: 'unknown',
            status: 'error',
            error: result.reason
        }
    );

    return { services: results };
});

// Auth service proxy
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.auth,
        prefix: '/api/auth',
        rewritePrefix: '/api/auth',
        http2: false
    });
});

// User service proxy
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.user,
        prefix: '/api/user',
        rewritePrefix: '/api/user',
        http2: false
    });
});

// Chat service proxy
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.chat,
        prefix: '/api/chat',
        rewritePrefix: '/api/chat',
        http2: false,
        websocket: true // Enable WebSocket proxying for chat
    });
});

// Game service proxy
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.game,
        prefix: '/api/game',
        rewritePrefix: '/api/game',
        http2: false,
        websocket: true // Enable WebSocket proxying for game
    });
});

// Register websocket plugin for proxy support
await fastify.register(websocket);

// Error handler
fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    reply.status(500).send({
        error: 'Internal gateway error',
        message: error.message
    });
});

// Not found handler
fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
        error: 'Route not found',
        path: request.url,
        availableRoutes: [
            '/health',
            '/health/services',
            '/api/auth/*',
            '/api/user/*',
            '/api/chat/*',
            '/api/game/*'
        ]
    });
});

// Start server
const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        fastify.log.info(`🚀 Gateway service running on port ${PORT}`);
        fastify.log.info(`📡 Proxying to services:`);
        Object.entries(services).forEach(([name, url]) => {
            fastify.log.info(`   - ${name}: ${url}`);
        });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    fastify.log.info('Received SIGTERM, shutting down gracefully');
    await fastify.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    fastify.log.info('Received SIGINT, shutting down gracefully');  
    await fastify.close();
    process.exit(0);
});

start();