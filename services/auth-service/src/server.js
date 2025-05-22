import Fastify from 'fastify';
import fastifyJWT from '@fastify/jwt';
import fastifyCORS from '@fastify/cors'
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import twoFARoutes from './routes/2fa.js';

dotenv.config();

const app = Fastify({logger: true});
app.register(fastifyJWT, {
	secret: process.env.JWT_SECRET,
});

app.register(fastifyCORS, {
	origin: true,
	credentials: true
});

app.register(authRoutes, {prefix: '/auth'});
app.register(twoFARoutes, {prefix: '/2fa'});

(async () => {
	try {
		await app.listen({ port: 3000 });
		console.log('Server ready on http:://localhost:3000');
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
})();