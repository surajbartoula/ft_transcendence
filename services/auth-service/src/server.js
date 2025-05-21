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

app.listen({port:3000}, (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Server ready at ${address}`);
});