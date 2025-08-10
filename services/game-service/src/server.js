import Fastify from 'fastify';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
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
	
	console.log('HTTPS configuration loaded for chat service');
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
const DATA_DIR = process.env.DOCKER_ENV ? '/app/data' : './data';

// CORS plugin
await fastify.register(import('@fastify/cors'), {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
});

// Initialize data directory
async function initializeDataDir() {
  try {
    await access(DATA_DIR);
  } catch (error) {
    await mkdir(DATA_DIR, { recursive: true });
    fastify.log.info(`Created data directory: ${DATA_DIR}`);
  }
}

// Database helper functions
async function readJsonFile(filename) {
  try {
    const filePath = join(DATA_DIR, filename);
    const data = await readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeJsonFile(filename, data) {
  const filePath = join(DATA_DIR, filename);
  await writeFile(filePath, JSON.stringify(data, null, 2));
}

// Initialize sample data
async function initializeSampleData() {
  const gamesFile = 'games.json';
  const playersFile = 'players.json';
  const scoresFile = 'scores.json';

  // Initialize games if not exists
  let games = await readJsonFile(gamesFile);
  if (!games) {
    games = [
      {
        id: randomUUID(),
        name: 'Space Invaders',
        genre: 'Arcade',
        maxPlayers: 1,
        createdAt: new Date().toISOString()
      },
      {
        id: randomUUID(),
        name: 'Multiplayer Snake',
        genre: 'Arcade',
        maxPlayers: 4,
        createdAt: new Date().toISOString()
      }
    ];
    await writeJsonFile(gamesFile, games);
  }

  // Initialize players if not exists
  let players = await readJsonFile(playersFile);
  if (!players) {
    players = [];
    await writeJsonFile(playersFile, players);
  }

  // Initialize scores if not exists
  let scores = await readJsonFile(scoresFile);
  if (!scores) {
    scores = [];
    await writeJsonFile(scoresFile, scores);
  }
}

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'game-service',
    version: '1.0.0'
  };
});

// Games endpoints
fastify.get('/api/games', async (request, reply) => {
  const games = await readJsonFile('games.json');
  return { games: games || [] };
});

fastify.get('/api/games/:id', async (request, reply) => {
  const { id } = request.params;
  const games = await readJsonFile('games.json') || [];
  const game = games.find(g => g.id === id);
  
  if (!game) {
    reply.code(404);
    return { error: 'Game not found' };
  }
  
  return { game };
});

fastify.post('/api/games', async (request, reply) => {
  const { name, genre, maxPlayers = 1 } = request.body;
  
  if (!name || !genre) {
    reply.code(400);
    return { error: 'Name and genre are required' };
  }
  
  const games = await readJsonFile('games.json') || [];
  const newGame = {
    id: randomUUID(),
    name,
    genre,
    maxPlayers: parseInt(maxPlayers),
    createdAt: new Date().toISOString()
  };
  
  games.push(newGame);
  await writeJsonFile('games.json', games);
  
  reply.code(201);
  return { game: newGame };
});

fastify.delete('/api/games/:id', async (request, reply) => {
  const { id } = request.params;
  const games = await readJsonFile('games.json') || [];
  const gameIndex = games.findIndex(g => g.id === id);
  
  if (gameIndex === -1) {
    reply.code(404);
    return { error: 'Game not found' };
  }
  
  games.splice(gameIndex, 1);
  await writeJsonFile('games.json', games);
  
  return { message: 'Game deleted successfully' };
});

// Players endpoints
fastify.get('/api/players', async (request, reply) => {
  const players = await readJsonFile('players.json');
  return { players: players || [] };
});

fastify.get('/api/players/:id', async (request, reply) => {
  const { id } = request.params;
  const players = await readJsonFile('players.json') || [];
  const player = players.find(p => p.id === id);
  
  if (!player) {
    reply.code(404);
    return { error: 'Player not found' };
  }
  
  return { player };
});

fastify.post('/api/players', async (request, reply) => {
  const { username, email } = request.body;
  
  if (!username || !email) {
    reply.code(400);
    return { error: 'Username and email are required' };
  }
  
  const players = await readJsonFile('players.json') || [];
  
  // Check if player already exists
  const existingPlayer = players.find(p => p.username === username || p.email === email);
  if (existingPlayer) {
    reply.code(409);
    return { error: 'Player with this username or email already exists' };
  }
  
  const newPlayer = {
    id: randomUUID(),
    username,
    email,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };
  
  players.push(newPlayer);
  await writeJsonFile('players.json', players);
  
  reply.code(201);
  return { player: newPlayer };
});

// Scores endpoints
fastify.get('/api/scores', async (request, reply) => {
  const { gameId, playerId, limit = 10 } = request.query;
  let scores = await readJsonFile('scores.json') || [];
  
  if (gameId) {
    scores = scores.filter(s => s.gameId === gameId);
  }
  
  if (playerId) {
    scores = scores.filter(s => s.playerId === playerId);
  }
  
  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  
  // Limit results
  scores = scores.slice(0, parseInt(limit));
  
  return { scores };
});

fastify.post('/api/scores', async (request, reply) => {
  const { gameId, playerId, score, metadata = {} } = request.body;
  
  if (!gameId || !playerId || score === undefined) {
    reply.code(400);
    return { error: 'GameId, playerId, and score are required' };
  }
  
  // Verify game and player exist
  const games = await readJsonFile('games.json') || [];
  const players = await readJsonFile('players.json') || [];
  
  const game = games.find(g => g.id === gameId);
  const player = players.find(p => p.id === playerId);
  
  if (!game) {
    reply.code(404);
    return { error: 'Game not found' };
  }
  
  if (!player) {
    reply.code(404);
    return { error: 'Player not found' };
  }
  
  const scores = await readJsonFile('scores.json') || [];
  const newScore = {
    id: randomUUID(),
    gameId,
    playerId,
    score: parseInt(score),
    metadata,
    createdAt: new Date().toISOString()
  };
  
  scores.push(newScore);
  await writeJsonFile('scores.json', scores);
  
  reply.code(201);
  return { score: newScore };
});

// Leaderboard endpoint
fastify.get('/api/leaderboard/:gameId', async (request, reply) => {
  const { gameId } = request.params;
  const { limit = 10 } = request.query;
  
  const scores = await readJsonFile('scores.json') || [];
  const players = await readJsonFile('players.json') || [];
  const games = await readJsonFile('games.json') || [];
  
  const game = games.find(g => g.id === gameId);
  if (!game) {
    reply.code(404);
    return { error: 'Game not found' };
  }
  
  // Get scores for this game
  const gameScores = scores
    .filter(s => s.gameId === gameId)
    .sort((a, b) => b.score - a.score)
    .slice(0, parseInt(limit));
  
  // Enrich with player data
  const leaderboard = gameScores.map(score => {
    const player = players.find(p => p.id === score.playerId);
    return {
      ...score,
      playerName: player ? player.username : 'Unknown Player'
    };
  });
  
  return { 
    game: game.name,
    leaderboard 
  };
});

// Game sessions (for active games)
const activeSessions = new Map();

fastify.post('/api/sessions', async (request, reply) => {
  const { gameId, playerId } = request.body;
  
  if (!gameId || !playerId) {
    reply.code(400);
    return { error: 'GameId and playerId are required' };
  }
  
  const sessionId = randomUUID();
  const session = {
    id: sessionId,
    gameId,
    playerId,
    startedAt: new Date().toISOString(),
    status: 'active'
  };
  
  activeSessions.set(sessionId, session);
  
  reply.code(201);
  return { session };
});

fastify.get('/api/sessions/:id', async (request, reply) => {
  const { id } = request.params;
  const session = activeSessions.get(id);
  
  if (!session) {
    reply.code(404);
    return { error: 'Session not found' };
  }
  
  return { session };
});

fastify.delete('/api/sessions/:id', async (request, reply) => {
  const { id } = request.params;
  
  if (!activeSessions.has(id)) {
    reply.code(404);
    return { error: 'Session not found' };
  }
  
  activeSessions.delete(id);
  return { message: 'Session ended successfully' };
});

// Server info endpoint
fastify.get('/api/info', async (request, reply) => {
  return {
    service: 'game-service',
    version: '1.0.0',
    environment: process.env.DOCKER_ENV ? 'docker' : 'local',
    uptime: process.uptime(),
    activeSessions: activeSessions.size,
    endpoints: [
      'GET /health',
      'GET /api/games',
      'POST /api/games',
      'GET /api/games/:id',
      'DELETE /api/games/:id',
      'GET /api/players',
      'POST /api/players',
      'GET /api/players/:id',
      'GET /api/scores',
      'POST /api/scores',
      'GET /api/leaderboard/:gameId',
      'POST /api/sessions',
      'GET /api/sessions/:id',
      'DELETE /api/sessions/:id'
    ]
  };
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.code(500).send({ 
    error: 'Internal Server Error',
    message: error.message 
  });
});

// Start server
const start = async () => {
  try {
    await initializeDataDir();
    await initializeSampleData();
    
    await fastify.listen({ 
      port: PORT, 
      host: process.env.DOCKER_ENV ? '0.0.0.0' : 'localhost' 
    });
    
    fastify.log.info(`Game service running on port ${PORT}`);
    fastify.log.info(`Data directory: ${DATA_DIR}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();