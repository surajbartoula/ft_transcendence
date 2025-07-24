import Fastify from 'fastify';
import cors from '@fastify/cors';
import httpProxy from '@fastify/http-proxy';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
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
    }
});

const PORT = process.env.PORT || 3005;

/** Register CORS plugin */
await fastify.register(cors, {
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        process.env.FRONTEND_DOCKER_URL || 'http://frontend:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

/** Service endpoints configuration */
const services = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    user: process.env.USER_SERVICE_URL || 'http://localhost:3002',
    chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3003',
    game: process.env.GAME_SERVICE_URL || 'http://localhost:3004'
};

await fastify.register(async function (fastify) {
    await fastify.register(httpProxy, {
        upstream: services.user,
        prefix: '/uploads',
        rewritePrefix: '/uploads',
        http2: false
    });
});

/** Health check endpoint */
fastify.get('/health', async (request, reply) => {
    return {
        status: 'healthy',
        service: 'gateway-service',
        timestamp: new Date().toISOString(),
        services: Object.keys(services)
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
        // Increase timeout for file uploads
        http: {
            requestOptions: {
                timeout: 30000 // 30 seconds
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

/** Custom Error handler */
fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    reply.status(500).send({
        error: 'Internal gateway error',
        message: error.message
    });
});

/** Custom handler for requests that don't match any route */
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
            '/api/game/*',
			'/socket.io/* (WebSocket)'
        ]
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
		/** Setup Socket.io server on the same HTTP server */
		const io = new Server(fastify.server, {
			cors: {
				origin: [
					process.env.FRONTEND_URL || 'http://localhost:3000',
					process.env.FRONTEND_DOCKER_URL || 'http://frontend:3000'
				],
				credentials: true
			},
			path: '/socket.io/'
		});
		io.on('connection', (clientSocket) => {
			fastify.log.info(`Client connected: ${clientSocket.id}`);
			/** store service connection for this client */
			let chatConnection = null;
			/** Proxy auth to chat service */
			clientSocket.on('auth', (data) => {
				fastify.log.info('Client authenticating with token');
				/** Create connection to chat service */
				chatConnection = ioClient(services.chat, {
					path: '/socket.io/',
					auth: {
						token: data.token
					},
					reconnection: true,
					reconnectionAttempts: 5,
					reconnectionDelay: 1000
				});
				chatConnection.on('connect', () => {
					fastify.log.info('Connected to chat service');
					clientSocket.emit('auth:success', { service: 'chat' });
				});
				chatConnection.on('connect_error', (error) => {
					fastify.log.error(`Chat service connection error: ${error.message}`);
					clientSocket.emit('auth:error', { error: error.message });
				});
				/** Proxy all events from client to chat service */
				const clientEvents = [
					'message:send',
					'message:typing',
					'message:read',
					'game:invite',
					'game:invite:accept',
					'game:invite:decline',
					'notification:read'
				];
				clientEvents.forEach(event => {
					clientSocket.on(event, (data) => {
						fastify.log.debug(`Proxying ${event} to chat service`);
						if (chatConnection && chatConnection.connected) {
							chatConnection.emit(event, data);
						} else {
							clientSocket.emit('error', {
								message: 'Not connected to chat service',
								event
							});
						}
					});
				});
				/** Proxy all events from chat service to client */
				const serviceEvents = [
					'message:receive',
					'message:sent',
					'message:typing',
					'message:read',
					'game:invite:received',
					'game:invite:sent',
					'game:invite:accepted',
					'game:invite:declined',
					'tournament:notification',
					'notification:read:success',
					'user:online',
					'user:offline',
					'user:blocked',
					'error'
				];
				serviceEvents.forEach(event => {
					chatConnection.on(event, (data) => {
						fastify.log.debug(`Proxying ${event} to client`);
						clientSocket.emit(event, data);
					});
				});
				/** Handle chat service disconnection */
				chatConnection.on('disconnect', (reason) => {
					fastify.log.warn(`Disconnected from chat service: ${reason}`);
					clientSocket.emit('service:disconnected', { service: 'chat', reason });
				});
			});
			/** Handle client disconnect */
			clientSocket.on('disconnect', () => {
				fastify.log.info(`Client disconnected: ${clientSocket.id}`);
				if (chatConnection) {
					chatConnection.disconnect();
					chatConnection = null;
				}
			});
		});
        fastify.log.info(`🚀 Gateway service running on port ${PORT}`);
        fastify.log.info(`📡 Proxying to services:`);
        Object.entries(services).forEach(([name, url]) => {
            fastify.log.info(`   - ${name}: ${url}`);
        });
		fastify.log.info(`🔌 Socket.io gateway active on /socket.io/`);
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