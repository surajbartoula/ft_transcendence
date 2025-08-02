import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fastifySocketIO from 'fastify-socket.io';

import { initDatabase } from './database.js';
import { registerRoutes } from './routes.js';
import { setupSocketHandlers } from './socketHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const fastify = Fastify({ logger: true });

async function setupFastify() {
  // Register CORS
  await fastify.register(cors, {
    origin: CORS_ORIGIN,
    credentials: true
  });

  // Register JWT
  await fastify.register(jwt, { 
    secret: JWT_SECRET
  });

  // Register Socket.IO
  await fastify.register(fastifySocketIO, {
    cors: {
      origin: CORS_ORIGIN,
      credentials: true
    }
  });

  // Register routes
  registerRoutes(fastify);

  // Setup Socket.IO handlers
  setupSocketHandlers(fastify);
}

async function start() {
  try {
    // Initialize database first
    await initDatabase();
    
    // Setup Fastify plugins and routes
    await setupFastify();
    
    // Start the server
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Chat service running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();