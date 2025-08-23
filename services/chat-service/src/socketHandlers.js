import { dbService, getUserProfile } from './database.js';

export function setupSocketHandlers(fastify) {
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
      socket.token = token;
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
	try {
		const friends = await dbService.getUserFriends(user_id);
		const friendIds = friends.map(friend => friend.user_id);
		/** Notify each online friend that the user came online */
		for (const friendId of friendIds) {
			const friendSession = await dbService.getUserSession(friendId);
			if (friendSession) {
				fastify.io.to(friendSession.socket_id).emit('user_online', { user_id });
			}
		}
	} catch (err) {
		console.error('Error broadcasting user online status:', err);
	}

	/** Handle request for online users list */
	socket.on('get_online_users', async () => {
		try {
			const friends = await dbService.getUserFriends(user_id);
			const onlineUserIds = [];
			for (const friend of friends) {
				const friendSession = await dbService.getUserSession(friend.user_id);
				if (friendSession) onlineUserIds.push(friend.user_id);
			}
			socket.emit('online_users_list', { user_ids: onlineUserIds });
		} catch (err) {
			console.error('Error getting online users:', err);
		}
	});

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
	  try {
		const friends = await dbService.getUserFriends(user_id);
		const friendIds = friends.map(friend => friend.user_id);
		for (const friendId of friendIds) {
			const friendSession = await dbService.getUserSession(friendId);
			if (friendSession) {
				fastify.io.to(friendSession.socket_id).emit('user_offline', {user_id});
			}
		}
	  } catch (err) {
		console.error('Error broadcasting user offline status:', err);
	  }
    });
  });
}