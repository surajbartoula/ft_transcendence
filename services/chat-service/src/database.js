import sqlite3 from 'sqlite3';
import path, { join } from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

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

export function initDatabase() {
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

export function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

/** Helper function to extract token from request */
function getTokenFromRequest(req) {
  return req.headers.authorization?.replace('Bearer ', '');
}

async function getUserProfile(userId, token = null) {
  try {
    const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'https://user-service:3002';
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
    const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'https://user-service:3002';
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
          id: profile.user_id, // Add normalized id field for frontend compatibility
          display_name: profile.display_name || profile.username || `User ${profile.user_id}`
        };
      });
    }
    userIds.forEach(userId => {
      if (!profiles[userId]) {
        profiles[userId] = {
          user_id: userId,
          id: userId, // Add normalized id field for frontend compatibility
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
    const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'https://user-service:3002';
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
export const dbService = {
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

 async getUserFriends(userId) {
    return await db.allAsync(`
      SELECT DISTINCT 
        CASE 
          WHEN requester_id = ? THEN addressee_id 
          ELSE requester_id 
        END as user_id
      FROM friends 
      WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'
    `, [userId, userId, userId]);
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
    
    return onlineFriends.map(friend => {
      const profile = userProfiles[friend.friend_id];
      return {
        ...profile,
        id: profile.user_id, // Normalize field name for frontend compatibility
        display_name: profile.display_name || profile.username || `User ${profile.user_id}`,
        last_seen: friend.last_seen,
        is_online: true
      };
    });
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

export { getUserProfile, getUserProfiles, searchUsers, getTokenFromRequest };