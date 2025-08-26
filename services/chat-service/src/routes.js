import { dbService, getUserProfile, getUserProfiles, searchUsers, getTokenFromRequest } from './database.js';

export function registerRoutes(fastify) {
  /** Authentication decorator */
  fastify.decorate('authenticate', async function(request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  /** User profile route */
  fastify.get('/api/chat/user/profile', {
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
  fastify.get('/api/chat/chats/recent', {
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
  fastify.get('/api/chat/friends/details', {
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
  fastify.get('/api/chat/friends/requests/details', {
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
  fastify.get('/api/chat/friends/online', {
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
  fastify.get('/api/chat/chats/stats', {
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
  fastify.get('/api/chat/users/search', {
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

  fastify.post('/api/chat/friends/request', {
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

  fastify.post('/api/chat/friends/accept', {
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

  fastify.post('/api/chat/friends/decline', {
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

  fastify.get('/api/chat/friends/requests', {
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

  fastify.get('/api/chat/friends', {
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

  fastify.post('/api/chat/users/block', {
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

  fastify.post('/api/chat/users/unblock', {
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

  fastify.get('/api/chat/users/blocked', {
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

  fastify.post('/api/chat/users/is-blocked-by', {
    preValidation: [fastify.authenticate],
  }, async (req, reply) => {
      const user_id = req.user.sub || req.user.user_id || req.user.id;
      const { user_id: other_user_id } = req.body;
      try {
        const isBlocked = await dbService.isUserBlockedBy(other_user_id, user_id);
        reply.send({ is_blocked: isBlocked });
      } catch (err) {
        req.log.error(err);
        reply.code(500).send({ error: 'Failed to check blocked status' });
      }
  });

  /**
   * Message routes
   */

  fastify.get('/api/chat/messages/:friend_id', {
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

  fastify.get('/api/chat/messages/unread/count', {
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

  fastify.post('/api/chat/messages/:friend_id/mark-read', {
    preValidation: [fastify.authenticate],
  }, async (req, reply) => {
      const user_id = req.user.sub || req.user.user_id || req.user.id;
      const { friend_id } = req.params;
      try {
        /** Check if users are friends */
        const areFriends = await dbService.areFriends(user_id, friend_id);
        if (!areFriends) {
          return reply.code(403).send({ error: 'Can only mark messages as read with friends' });
        }
        /** Mark all unread messages from this friend as read */
        await dbService.markConversationAsRead(user_id, friend_id);
        reply.send({ success: true });
      } catch (err) {
        req.log.error(err);
        reply.code(500).send({ error: 'Failed to mark messages as read' });
      }
  });
}