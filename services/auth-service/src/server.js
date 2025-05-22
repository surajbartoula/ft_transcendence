import Fastify from 'fastify';
import fastifyJWT from '@fastify/jwt';
import fastifyCORS from '@fastify/cors'
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import twoFARoutes from './routes/2fa.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the .env file from the root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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