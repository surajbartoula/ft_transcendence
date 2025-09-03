import Fastify from 'fastify';
import cors from '@fastify/cors';
import httpProxy from '@fastify/http-proxy';
import fastifyStatic from '@fastify/static';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 3000;

if (!process.env.SSL_CERT || !process.env.SSL_KEY) {
	console.error('SSL_CERT & SSL_KEY not found');
	process.exit(1);
}

let httpsOptions;
try {
	if (!fs.existsSync(process.env.SSL_CERT) || !fs.existsSync(process.env.SSL_KEY)) {
		console.error('SSL Certificates not found');
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
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.LOG_PRETTY === 'true' ? {
            target: 'pino-pretty',
            options: {
                colorize: true
            }
        } : undefined
    },
	https: httpsOptions
});

/** Register CORS plugin */
await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

/** Register static file serving for frontend build */
await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../dist'),
    prefix: '/',
    setHeaders: (res, path) => {
        // Set proper headers for SPA
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    },
    // Handle SPA routing by serving index.html for non-file routes
    wildcard: false
});

/** Service endpoints configuration */
const services = {
    auth: process.env.AUTH_SERVICE_URL || 'https://auth-service:3001',
    user: process.env.USER_SERVICE_URL || 'https://user-service:3002',
    chat: process.env.CHAT_SERVICE_URL || 'https://chat-service:3003',
    game: process.env.GAME_SERVICE_URL || 'https://game-service:3004'
};

/** Helper function to fetch user profile from user service */
async function fetchUserProfile(userId, authToken = null) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(`${services.user}/api/user/profile?user_id=${userId}`, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        fastify.log.error(`Failed to fetch profile for user ${userId}:`, error);
        return null;
    }
}

/** Static file serving for uploads */
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.user,
        prefix: '/uploads',
        rewritePrefix: '/uploads',
        http2: false
    });
});

/** Static file serving for assets (default avatar) */
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.user,
        prefix: '/assets',
        rewritePrefix: '/assets',
        http2: false
    });
});

/** Health check endpoint */
fastify.get('/health', async (request, reply) => {
    return {
        status: 'healthy',
        service: 'gateway-service',
        timestamp: new Date().toISOString(),
        services: Object.keys(services),
		ssl: true
    };
});

/** Service health check endpoint */
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

/** Auth service proxy */
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.auth,
        prefix: '/api/auth',
        rewritePrefix: '/api/auth',
        http2: false
    });
});

/** User service proxy */
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.user,
        prefix: '/api/user',
        rewritePrefix: '/api/user',
        http2: false,
        http: {
            requestOptions: {
                timeout: 30000 /** 30 sec */
            }
        }
    });
});

/** Chat service proxy */
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.chat,
        prefix: '/api/chat',
        rewritePrefix: '/api/chat',
        http2: false
    });
});

/** Game service proxy */
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.game,
        prefix: '/api/game',
        rewritePrefix: '/api/game',
        http2: false,
    });
});

/** Chat Socket.IO proxy */
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.chat,
        prefix: '/chat-socket',
        rewritePrefix: '/socket.io',
        websocket: true,
        http2: false
    });
});

/** Game Socket.IO proxy */
await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.game,
        prefix: '/game-socket',
        rewritePrefix: '/socket.io',
        websocket: true,
        http2: false
    });
});

/** Custom Error handler */
fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    reply.status(500).send({
        error: 'Internal gateway error',
        message: error.message
    });
});

/** Handle default Socket.IO attempts and redirect to proper endpoints */
fastify.get('/socket.io/*', async (request, reply) => {
    fastify.log.warn(`Default Socket.IO path accessed: ${request.url} - redirecting client to use proper endpoints`);
    reply.status(400).send({
        error: 'Direct Socket.IO connection not allowed',
        message: 'Use /chat-socket for chat features or /game-socket for game features',
        availableEndpoints: [
            '/chat-socket - for chat, messaging, friend requests',
            '/game-socket - for games, tournaments, match-making'
        ]
    });
});

/** Custom handler for requests that don't match any route */
fastify.setNotFoundHandler((request, reply) => {
    // Extract just the pathname (without query parameters)
    const pathname = request.url.split('?')[0];
    
    // Check if it's a file request (has extension)
    const isFileRequest = pathname.includes('.') && pathname.lastIndexOf('.') > pathname.lastIndexOf('/');
    
    fastify.log.info(`NotFound handler: ${request.url} | pathname: ${pathname} | isFile: ${isFileRequest}`);
    
    // For SPA routes (not API routes or files), serve index.html
    if (!pathname.startsWith('/api/') && 
        !pathname.startsWith('/uploads/') && 
        !pathname.startsWith('/assets/') &&
        !pathname.startsWith('/health') &&
        !pathname.startsWith('/socket.io/') &&
        !isFileRequest) {
        fastify.log.info(`Serving SPA index.html for: ${request.url}`);
        return reply.type('text/html').sendFile('index.html');
    }
    
    // For API routes that don't exist, return 404 JSON
    reply.status(404).send({
        error: 'Route not found',
        path: request.url,
        availableRoutes: [
            '/health',
            '/health/services',
            '/api/auth/*',
            '/api/user/*',
            '/api/chat/*',
            '/api/game/*',
            '/uploads/*',
            '/assets/*'
        ]
    });
});


const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        
		fastify.log.info(`🛜  Frontend running on port ${process.env.FRONTEND_URL}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

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