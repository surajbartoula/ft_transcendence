import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import path, { join } from 'path';
import fs from 'fs';
import fastifySocketIO from 'fastify-socket.io';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
	origin: CORS_ORIGIN,
	credentials: true
});

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

function getDatabasePath() {
	const isDocker = process.env.DOCKER_ENV || fs.existsSync('/app');
	if (isDocker) {
		const dataDir = '/app/data';
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}
		return join(dataDir, 'chat.db');
	}
	return process.env.DATABASE_PATH || join(__dirname, '../chat.db');
}

let db;

function initDatabase() {
	const dbPath = getDatabasePath();
	db = new sqlite3.Database(dbPath);
	console.log('Connected chat.db at:', dbPath);
	/** Promisify database methods with proper context handling */
	db.runAsync = function(sql, params = []) {
		return new Promise((resolve, reject) => {
			db.run(sql, params, function(err) {
				if (err) {
					reject(err);
				} else {
					// 'this' context contains lastID, changes, etc.
					resolve(this);
				}
			});
		});
	};
	
	db.getAsync = promisify(db.get).bind(db);
	db.allAsync = promisify(db.all).bind(db);
	const execAsync = promisify(db.exec).bind(db);
	return execAsync(`
		CREATE TABLE IF NOT EXISTS friends (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			requester_id TEXT NOT NULL,
			addressee_id TEXT NOT NULL,
			status TEXT DEFAULT 'pending',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(requester_id, addressee_id)
		);
		CREATE TABLE IF NOT EXISTS blocked_users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			blocker_id TEXT NOT NULL,
			blocked_id TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(blocker_id, blocked_id)
		);
		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sender_id TEXT NOT NULL,
			receiver_id TEXT NOT NULL,
			content TEXT NOT NULL,
			message_type TEXT DEFAULT 'text',
			read_at DATETIME NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TABLE IF NOT EXISTS user_sessions (
			user_id TEXT PRIMARY KEY,
			socket_id TEXT NOT NULL,
			last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_friends_requester ON friends(requester_id);
		CREATE INDEX IF NOT EXISTS idx_friends_addressee ON friends(addressee_id);
		CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users(blocker_id);
		CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON blocked_users(blocked_id);
		CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
		CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
	`);
}

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';

/** Helper function to extract token from request */
function getTokenFromRequest(req) {
  return req.headers.authorization?.replace('Bearer ', '');
}

async function getUserProfile(userId, token = null) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${USER_SERVICE_URL}/api/user/profile/${userId}`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.status}`);
    }
    const data = await response.json();
    
    /** Transform the response to include display_name if it doesn't exist */
    return {
      ...data,
      display_name: data.display_name || data.username || `User ${data.user_id}`
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return {
      user_id: userId,
      username: `user_${userId}`,
      display_name: `User ${userId}`,
      bio: null,
      created_at: new Date().toISOString(),
      photo: null
    };
  }
}

async function getUserProfiles(userIds, token = null) {
  try {
    if (!userIds || userIds.length === 0) {
      return {};
    }
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${USER_SERVICE_URL}/api/user/profiles/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userIds })
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch user profiles: ${response.status}`);
    }
    const data = await response.json();
    const profiles = {};
    if (data.success && data.profiles) {
      data.profiles.forEach(profile => {
        profiles[profile.user_id] = {
          ...profile,
          display_name: profile.display_name || profile.username || `User ${profile.user_id}`
        };
      });
    }
    userIds.forEach(userId => {
      if (!profiles[userId]) {
        profiles[userId] = {
          user_id: userId,
          username: `user_${userId}`,
          display_name: `User ${userId}`,
          bio: null,
          created_at: new Date().toISOString(),
          photo: null
        };
      }
    });
    return profiles;
  } catch (error) {
    console.error('Error fetching user profiles:', error);
    const profiles = {};
    userIds.forEach(userId => {
      profiles[userId] = {
        user_id: userId,
        username: `user_${userId}`,
        display_name: `User ${userId}`,
        bio: null,
        created_at: new Date().toISOString(),
        photo: null
      };
    });
    return profiles;
  }
}

async function searchUsers(query, currentUserId, token = null) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${USER_SERVICE_URL}/api/user/search?q=${encodeURIComponent(query)}&limit=20`, {
      headers
    });
    if (!response.ok) {
      throw new Error(`Failed to search users: ${response.status}`);
    }
    const data = await response.json();
    if (data.success && data.users) {
      return data.users
        .filter(user => user.user_id !== String(currentUserId))
        .map(user => ({
          ...user,
          display_name: user.display_name || user.username || `User ${user.user_id}`
        }));
    }
    return [];
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

/** Database service methods */
const dbService = {
  async sendFriendRequest(requesterId, addresseeId) {
    return await db.runAsync(
      'INSERT OR IGNORE INTO friends (requester_id, addressee_id) VALUES (?, ?)',
      [requesterId, addresseeId]
    );
  },

  async acceptFriendRequest(requesterId, addresseeId) {
    return await db.runAsync(
      'UPDATE friends SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE requester_id = ? AND addressee_id = ?',
      ['accepted', requesterId, addresseeId]
    );
  },

  async declineFriendRequest(requesterId, addresseeId) {
    return await db.runAsync(
      'UPDATE friends SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE requester_id = ? AND addressee_id = ?',
      ['declined', requesterId, addresseeId]
    );
  },

  async getFriendRequests(userId) {
    return await db.allAsync(
      'SELECT * FROM friends WHERE addressee_id = ? AND status = ?',
      [userId, 'pending']
    );
  },

  async getFriends(userId) {
    return await db.allAsync(`
      SELECT DISTINCT 
        CASE 
          WHEN requester_id = ? THEN addressee_id 
          ELSE requester_id 
        END as friend_id
      FROM friends 
      WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'
    `, [userId, userId, userId]);
  },

  async getFriendsWithDetails(userId, token = null) {
    const friends = await db.allAsync(`
      SELECT DISTINCT 
        CASE 
          WHEN requester_id = ? THEN addressee_id 
          ELSE requester_id 
        END as friend_id,
        f.created_at as friendship_date
      FROM friends f
      WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'
    `, [userId, userId, userId]);
    const friendIds = friends.map(f => f.friend_id);
    const userProfiles = await getUserProfiles(friendIds, token);
    
    return friends.map(friend => ({
      ...userProfiles[friend.friend_id],
      friendship_date: friend.friendship_date
    }));
  },

  async getRecentChats(userId, limit = 20, token = null) {
    // First get the basic chat info with friend_id and last message time
    const basicChats = await db.allAsync(`
      SELECT 
        CASE 
          WHEN sender_id = ? THEN receiver_id 
          ELSE sender_id 
        END as friend_id,
        MAX(created_at) as last_message_time
      FROM messages 
      WHERE sender_id = ? OR receiver_id = ?
      GROUP BY friend_id
      ORDER BY last_message_time DESC
      LIMIT ?
    `, [userId, userId, userId, limit]);
    /** For each chat, get the detailed info */
    const chats = await Promise.all(basicChats.map(async (chat) => {
      /** Get last message content and sender */
      const lastMessage = await db.getAsync(`
        SELECT content, sender_id
        FROM messages 
        WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
        ORDER BY created_at DESC 
        LIMIT 1
      `, [userId, chat.friend_id, chat.friend_id, userId]);
      const unreadResult = await db.getAsync(`
        SELECT COUNT(*) as count
        FROM messages 
        WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL
      `, [chat.friend_id, userId]);
      return {
        friend_id: chat.friend_id,
        last_message_time: chat.last_message_time,
        last_message: lastMessage?.content || '',
        last_message_sender: lastMessage?.sender_id || '',
        unread_count: unreadResult?.count || 0
      };
    }));
    /** Get user details for each chat participant in batch */
    const friendIds = chats.map(chat => chat.friend_id);
    const userProfiles = await getUserProfiles(friendIds, token);
    return chats.map(chat => ({
      ...chat,
      friend_profile: userProfiles[chat.friend_id]
    }));
  },

  async getFriendRequestsWithDetails(userId, token = null) {
    const requests = await db.allAsync(
      'SELECT requester_id, created_at FROM friends WHERE addressee_id = ? AND status = ?',
      [userId, 'pending']
    );
    const requesterIds = requests.map(r => r.requester_id);
    const userProfiles = await getUserProfiles(requesterIds, token);
    return requests.map(request => ({
      ...userProfiles[request.requester_id],
      request_date: request.created_at
    }));
  },

  async getOnlineFriends(userId, token = null) {
    const onlineFriends = await db.allAsync(`
      SELECT DISTINCT 
        us.user_id as friend_id,
        us.last_seen,
        us.socket_id
      FROM user_sessions us
      INNER JOIN friends f ON (
        (f.requester_id = ? AND f.addressee_id = us.user_id) OR 
        (f.addressee_id = ? AND f.requester_id = us.user_id)
      )
      WHERE f.status = 'accepted' 
      AND us.last_seen > datetime('now', '-5 minutes')
    `, [userId, userId]);
    const friendIds = onlineFriends.map(f => f.friend_id);
    const userProfiles = await getUserProfiles(friendIds, token);
    return onlineFriends.map(friend => ({
      ...userProfiles[friend.friend_id],
      last_seen: friend.last_seen,
      is_online: true
    }));
  },

  async areFriends(userId1, userId2) {
    const result = await db.getAsync(`
      SELECT 1 FROM friends 
      WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)) 
      AND status = 'accepted'
    `, [userId1, userId2, userId2, userId1]);
    return !!result;
  },

  /** Blocking functions */
  async blockUser(blockerId, blockedId) {
    return await db.runAsync(
      'INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)',
      [blockerId, blockedId]
    );
  },

  async unblockUser(blockerId, blockedId) {
    return await db.runAsync(
      'DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
      [blockerId, blockedId]
    );
  },

  async isBlocked(userId1, userId2) {
    const result = await db.getAsync(
      'SELECT 1 FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
      [userId1, userId2, userId2, userId1]
    );
    return !!result;
  },

  async getBlockedUsers(userId) {
    return await db.allAsync(
      'SELECT blocked_id FROM blocked_users WHERE blocker_id = ?',
      [userId]
    );
  },

  /** Messages functions */
  async saveMessage(senderId, receiverId, content, messageType = 'text') {
    const result = await db.runAsync(
      'INSERT INTO messages (sender_id, receiver_id, content, message_type) VALUES (?, ?, ?, ?)',
      [senderId, receiverId, content, messageType]
    );
    return result.lastID;
  },

  async getMessages(userId1, userId2, limit = 50, offset = 0) {
    return await db.allAsync(`
      SELECT * FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userId1, userId2, userId2, userId1, limit, offset]);
  },

  async markMessageAsRead(messageId, userId) {
    return await db.runAsync(
      'UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND receiver_id = ?',
      [messageId, userId]
    );
  },

  async getUnreadCount(userId) {
    const result = await db.getAsync(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read_at IS NULL',
      [userId]
    );
    return result.count;
  },

  /** User sessions function */
  async updateUserSession(userId, socketId) {
    return await db.runAsync(
      'INSERT OR REPLACE INTO user_sessions (user_id, socket_id, last_seen) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [userId, socketId]
    );
  },

  async updateUserHeartbeat(userId) {
    return await db.runAsync(
      'UPDATE user_sessions SET last_seen = CURRENT_TIMESTAMP WHERE user_id = ?',
      [userId]
    );
  },

  async removeUserSession(userId) {
    return await db.runAsync('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
  },

  async getUserSession(userId) {
    return await db.getAsync('SELECT * FROM user_sessions WHERE user_id = ?', [userId]);
  }
};

fastify.decorate('authenticate', async function(request, reply) {
	try {
		await request.jwtVerify();
	} catch (err) {
		reply.code(401).send({ error: 'Unauthorized' });
	}
});

/** All the Routes */

fastify.get('/api/user/profile', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const token = getTokenFromRequest(req);
    
    try {
      const profile = await getUserProfile(user_id, token);
      if (!profile) {
        return reply.code(404).send({ error: 'Profile not found' });
      }
      reply.send(profile);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch profile' });
    }
});

/** 
 * Chat section endpoints
 */

/** Get recent chats with last messages and unread counts */
fastify.get('/api/chats/recent', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const { limit = 20 } = req.query;
    const token = getTokenFromRequest(req);

    try {
      const recentChats = await dbService.getRecentChats(user_id, limit, token);
      /** Format the response with friend profile data */
      const chatsWithDetails = recentChats.map(chat => ({
        friend: chat.friend_profile,
        last_message: chat.last_message,
        last_message_time: chat.last_message_time,
        last_message_sender: chat.last_message_sender,
        unread_count: chat.unread_count,
        is_last_message_mine: chat.last_message_sender === user_id
      }));

      reply.send(chatsWithDetails);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch recent chats' });
    }
});

/** Get all friends with their details */
fastify.get('/api/friends/details', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const token = getTokenFromRequest(req);

    try {
      const friends = await dbService.getFriendsWithDetails(user_id, token);
      reply.send(friends);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch friends details' });
    }
});

/** Get all friend requests with requester details */
fastify.get('/api/friends/requests/details', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const token = getTokenFromRequest(req);

    try {
      const requests = await dbService.getFriendRequestsWithDetails(user_id, token);
      reply.send(requests);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch friend requests details' });
    }
});

/** Get online friends */
fastify.get('/api/friends/online', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const token = getTokenFromRequest(req);

    try {
      const onlineFriends = await dbService.getOnlineFriends(user_id, token);
      reply.send(onlineFriends);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch online friends' });
    }
});

/** Get chat statistics */
fastify.get('/api/chats/stats', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const token = getTokenFromRequest(req);

    try {
      const [unreadCount, friendsCount, onlineFriendsCount, pendingRequestsCount] = await Promise.all([
        dbService.getUnreadCount(user_id),
        dbService.getFriends(user_id).then(friends => friends.length),
        dbService.getOnlineFriends(user_id, token).then(friends => friends.length),
        dbService.getFriendRequests(user_id).then(requests => requests.length)
      ]);

      reply.send({
        unread_messages: unreadCount,
        total_friends: friendsCount,
        online_friends: onlineFriendsCount,
        pending_requests: pendingRequestsCount
      });
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch chat statistics' });
    }
});

/** Search users */
fastify.get('/api/users/search', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const { q: query } = req.query;
    const token = getTokenFromRequest(req);
    
    if (!query || query.length < 2) {
      return reply.code(400).send({ error: 'Query must be at least 2 characters' });
    }

    try {
      const users = await searchUsers(query, user_id, token);
      reply.send(users);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to search users' });
    }
});

/** 
 * Friend request routes
 */

fastify.post('/api/friends/request', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const { target_user_id } = req.body;
    const token = getTokenFromRequest(req);
    if (user_id === target_user_id) {
      return reply.code(400).send({ error: 'Cannot send friend request to yourself' });
    }
    try {
      const isBlocked = await dbService.isBlocked(user_id, target_user_id);
      if (isBlocked) {
        return reply.code(403).send({ error: 'Cannot send friend request' });
      }
      await dbService.sendFriendRequest(user_id, target_user_id);
      /** Get sender's profile for notification */
      const senderProfile = await getUserProfile(user_id, token);
      /** Notify target user via socket if online */
      const targetSession = await dbService.getUserSession(target_user_id);
      if (targetSession) {
        fastify.io.to(targetSession.socket_id).emit('friend_request', {
          from_user: senderProfile, /** Include full profile with photo and username */
          message: `${senderProfile.display_name} sent you a friend request`
        });
      }
      reply.send({ success: true });
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to send friend request' });
    }
});

fastify.post('/api/friends/accept', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const { requester_id } = req.body;
    const token = getTokenFromRequest(req);
    try {
      await dbService.acceptFriendRequest(requester_id, user_id);
      /** Get accepter's profile for notification */
      const accepterProfile = await getUserProfile(user_id, token);
      /** Notify requester via socket if online */
      const requesterSession = await dbService.getUserSession(requester_id);
      if (requesterSession) {
        fastify.io.to(requesterSession.socket_id).emit('friend_request_accepted', {
          from_user: accepterProfile, // Include full profile with photo and username
          message: `${accepterProfile.display_name} accepted your friend request`
        });
      }
      reply.send({ success: true });
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to accept friend request' });
    }
});

fastify.post('/api/friends/decline', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const { requester_id } = req.body;
    try {
      await dbService.declineFriendRequest(requester_id, user_id);
      reply.send({ success: true });
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to decline friend request' });
    }
});

fastify.get('/api/friends/requests', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    try {
      const requests = await dbService.getFriendRequests(user_id);
      reply.send(requests);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch friend requests' });
    }
});

fastify.get('/api/friends', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    try {
      const friends = await dbService.getFriends(user_id);
      reply.send(friends);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch friends' });
    }
});

/**
 * Block and unblock routes
 */

fastify.post('/api/users/block', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const { target_user_id } = req.body;
    if (user_id === target_user_id) {
      return reply.code(400).send({ error: 'Cannot block yourself' });
    }
    try {
      await dbService.blockUser(user_id, target_user_id);
      reply.send({ success: true });
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to block user' });
    }
});

fastify.post('/api/users/unblock', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const { target_user_id } = req.body;
    try {
      await dbService.unblockUser(user_id, target_user_id);
      reply.send({ success: true });
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to unblock user' });
    }
});

fastify.get('/api/users/blocked', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    try {
      const blocked = await dbService.getBlockedUsers(user_id);
      reply.send(blocked);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch blocked users' });
    }
});

/**
 * Message routes
 */

fastify.get('/api/messages/:friend_id', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    const { friend_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    try {
      /** Check if users are friends */
      const areFriends = await dbService.areFriends(user_id, friend_id);
      if (!areFriends) {
        return reply.code(403).send({ error: 'Can only view messages with friends' });
      }
      /** Check if blocked */
      const isBlocked = await dbService.isBlocked(user_id, friend_id);
      if (isBlocked) {
        return reply.code(403).send({ error: 'Cannot view messages with blocked user' });
      }
      const messages = await dbService.getMessages(user_id, friend_id, limit, offset);
      reply.send(messages.reverse());
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch messages' });
    }
});

fastify.get('/api/messages/unread/count', {
  preValidation: [fastify.authenticate],
}, async (req, reply) => {
    const user_id = req.user.sub || req.user.user_id || req.user.id;
    try {
      const count = await dbService.getUnreadCount(user_id);
      reply.send({ count });
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to fetch unread count' });
    }
});

/** Socket.IO authentication middleware */
fastify.io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    const decoded = fastify.jwt.verify(token);
    socket.user = decoded;
    socket.user_id = decoded.sub || decoded.user_id || decoded.id;
    socket.token = token; // Store the token for API calls
    
    if (!socket.user_id) {
      return next(new Error('Authentication error: Invalid user ID in token'));
    }
    
    next();
  } catch (err) {
    fastify.log.error('Socket JWT verification failed:', err);
    next(new Error('Authentication error: Invalid or expired token'));
  }
});

/** Socket.IO connection handling */
fastify.io.on('connection', async (socket) => {
  const user_id = socket.user_id;
  console.log(`User ${user_id} connected with socket ${socket.id}`);
  await dbService.updateUserSession(user_id, socket.id);
  /** Join user to their personal room */
  socket.join(`user_${user_id}`);
  /** Handle sending messages */
  socket.on('send_message', async (data) => {
    try {
      const { receiver_id, content, message_type = 'text' } = data;
      const areFriends = await dbService.areFriends(user_id, receiver_id);
      if (!areFriends) {
        socket.emit('error', { message: 'Can only send messages to friends' });
        return;
      }
      const isBlocked = await dbService.isBlocked(user_id, receiver_id);
      if (isBlocked) {
        socket.emit('error', { message: 'Cannot send message to blocked user' });
        return;
      }
      /** Save message to database */
      const messageId = await dbService.saveMessage(user_id, receiver_id, content, message_type);
      const messageData = {
        id: messageId,
        sender_id: user_id,
        receiver_id,
        content,
        message_type,
        created_at: new Date().toISOString()
      };
      /** Send to receiver if online */
      const receiverSession = await dbService.getUserSession(receiver_id);
      if (receiverSession) {
        /** Get sender profile for the message notification using stored token */
        const senderProfile = await getUserProfile(user_id, socket.token);
        fastify.io.to(receiverSession.socket_id).emit('new_message', {
          ...messageData,
          sender_profile: senderProfile
        });
      }
      /** Confirm to sender */
      socket.emit('message_sent', { message_id: messageId });
    } catch (err) {
      console.error('Error sending message:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  /** Handle marking messages as read */
  socket.on('mark_read', async (data) => {
    try {
      const { message_id } = data;
      await dbService.markMessageAsRead(message_id, user_id);
      socket.emit('message_read', { message_id });
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  });

  /** Handle typing indicators */
  socket.on('typing_start', async (data) => {
    try {
      const { receiver_id } = data;
      const receiverSession = await dbService.getUserSession(receiver_id);
      if (receiverSession) {
        fastify.io.to(receiverSession.socket_id).emit('user_typing', { user_id });
      }
    } catch (err) {
      console.error('Error handling typing start:', err);
    }
  });

  socket.on('typing_stop', async (data) => {
    try {
      const { receiver_id } = data;
      const receiverSession = await dbService.getUserSession(receiver_id);
      if (receiverSession) {
        fastify.io.to(receiverSession.socket_id).emit('user_stopped_typing', { user_id });
      }
    } catch (err) {
      console.error('Error handling typing stop:', err);
    }
  });

  /** Handle heartbeat to keep user online status updated */
  socket.on('heartbeat', async () => {
    try {
      await dbService.updateUserHeartbeat(user_id);
    } catch (err) {
      console.error('Error updating heartbeat:', err);
    }
  });

  socket.on('disconnect', async () => {
    console.log(`User ${user_id} disconnected`);
    await dbService.removeUserSession(user_id);
  });
});

async function start() {
  try {
    await initDatabase();
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Chat service running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();