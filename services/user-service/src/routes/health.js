export default async function healthRoutes(fastify, options) {
  fastify.get('/health', {
	schema: {
		tags: ['health'],
		summary: 'Health check',
		response: {
			200: {
				type: 'object',
				properties: {
				status: { type: 'string' },
				timestamp: { type: 'string' },
				service: { type: 'string' },
				version: { type: 'string' },
				uptime: { type: 'number' },
				database: { type: 'string' }
				}
			}
		}
	},
	handler: async (request, reply) => {
		try {
			// Check database connection
			let dbStatus = 'disconnected';
			try {
				await fastify.db.getAsync('SELECT 1');
				dbStatus = 'connected';
			} catch (error) {
				fastify.log.error('Database health check failed:', error);
			}
			return {
				status: 'healthy',
				timestamp: new Date().toISOString(),
				service: 'user-service',
				version: process.env.npm_package_version || '1.0.0',
				uptime: process.uptime(),
				database: dbStatus
			};
		} catch (error) {
			fastify.log.error('Health check failed:', error);
			return reply.code(503).send({
			status: 'unhealthy',
			timestamp: new Date().toISOString(),
			service: 'user-service',
			error: error.message
		});
		}
	}
  });

  /** Ready or not check end point */
  fastify.get('/ready', {
	schema: {
		tags: ['health'],
		summary: 'Readiness check',
		response: {
		200: {
			type: 'object',
			properties: {
			status: { type: 'string' },
			timestamp: { type: 'string' },
			checks: {
				type: 'object',
				properties: {
				database: { type: 'string' }
				}
			}
			}
		}
		}
	},
	handler: async (request, reply) => {
		const checks = {
			database: 'fail'
		};
		try {
			await fastify.db.getAsync('SELECT 1');
			checks.database = 'pass';
		} catch (error) {
			fastify.log.error('Database readiness check failed:', error);
		}
		const allChecksPass = Object.values(checks).every(check => check === 'pass');
		if (allChecksPass) {
			return {
				status: 'ready',
				timestamp: new Date().toISOString(),
				checks
			};
		} else {
			return reply.code(503).send({
				status: 'not ready',
				timestamp: new Date().toISOString(),
				checks
			});
		}
	}
  });

  /**Live or not */
  fastify.get('/live', {
	schema: {
		tags: ['health'],
		summary: 'Liveness check',
		response: {
			200: {
				type: 'object',
				properties: {
					status: { type: 'string' },
					timestamp: { type: 'string' }
				}
			}
		}
	},
	handler: async (request, reply) => {
		return {
			status: 'alive',
			timestamp: new Date().toISOString()
		};
	}
  });
}