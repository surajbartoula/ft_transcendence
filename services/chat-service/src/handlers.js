import jwt from 'jsonwebtoken';

/** socketManager is helper object to track online users (userId - socketId) from  socket.js*/
/** db from database.js */
export function setupSocketHandlers(io, socketManager, db) {
	/** Auth middleware runs before each connection is accepted */
	/** if next is passed without arg then the socket connection continues else rejected */
	io.use(async (socket, next) => {
		try {
			const token = socket.handshake.auth.token; /** extract jwt token from the connection */
			if (!token) {
				return next(new Error('Authentication error'));
			}
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			socket.userId = decoded.id;
			next();
		} catch (err) {
			next(new Error('Authentication error'));
		}
	});

	io.on('connection', (socket) => {
		console.log(`User ${socket.userId} connected`);
		socketManager.addUser(socket.userId, socket.id);
		socket.join(`user:${socket.userId}`); /** let them join private room */
		socket.broadcast.emit('user:online', {userId: socket.userId});

		/** message handler, socket.on(event, callback) listens for events and socket.emit sends */
		socket.on('message:send', async (data) => {
			try {
				const { recipientId, content, type = 'text' } = data;
				const senderId = socket.userId;
				const isBlocked = await db.isBlocked(recipientId, senderId);
				if (isBlocked) {
					return socket.emit('error', { message: 'You are blocked by this user' });
				}
				const message = await db.saveMessage(senderId, recipientId, content, type);
				/** Send to recipient if online */
				const recipientSocketId = socketManager.getSocketId(recipientId);
				if (recipientSocketId) {
					io.to(recipientSocketId).emit('message:receive', {
						id: message.id,
						senderId,
						content,
						type,
						createdAt: message.created_at
					});
				}
				/** Acknowledge to sender */
				socket.emit('message:sent', { ...message });
			} catch (error) {
				socket.emit('error', { message: error.message });
			}
		});

		socket.on('message:typing', ({ recipientId, isTyping }) => {
			const recipientSocketId = socketManager.getSocketId(recipientId);
			if (recipientSocketId) {
				io.to(recipientSocketId).emit('message:typing', {
					senderId: socket.userId,
					isTyping
				});
			}
		});

		socket.on('message:read', async ({ messageId }) => {
			try {
				await db.markAsRead(messageId, socket.userId);
				const message = await db.get('SELECT sender_id FROM messages WHERE id = ?', [messageId]);
				if (message) {
					const senderSocketId = socketManager.getSocketId(message.sender_id);
					if (senderSocketId) {
						io.to(senderSocketId).emit('message:read', { messageId });
					}
				}
			} catch (error) {
				socket.emit('error', { message: error.message });
			}
		});

		/** game invite handlers */
		socket.on('game:invite', async ({ recipientId }) => {
			try {
				const senderID = socket.userId;
				const isBlocked = await db.isBlocked(recipientId, senderID);
				if (isBlocked) {
					return socket.emit('error', { message: 'You are blocked by this user' });
				}
				/** create invite */
				const invite = await db.createGameInvite(senderiD, recipientId);
				const sender = await db.getUser(senderID);
				/** notify recipient if online */
				const recipientSocketId = socketManager.getSocketId(recipientId);
				if (recipientSocketId) {
					io.to(recipientSocketId).emit('game:invite:received', {
						inviteId: invite.id,
						senderID,
						senderUsername: sender.username,
						expiresAt: invite.expires_at
					});
				}
				socket.emit('game:invite:sent', { inviteId: invite.id });
			} catch (error) {
				socket.emit('error', { message: error.message });
			}
		});

		socket.on('game:invite:accept', async ({ inviteId }) => {
			try {
				const invite = await db.getInvite(inviteId);
				if (!invite || invite.recipient_id !== socket.userId || invite.status !== 'pending') {
					return socket.emit('error', { message: 'Invalid invite' });
				}
				const gameRoomId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
				await db.updateInviteStatus(inviteId, 'accepted', gameRoomId);
				/** notify both player */
				const senderSocketId = socketManager.getSocketId(invite.sender_id);
				if (senderSocketId) {
					io.to(senderSocketId).emit('game:invite:accepted', { inviteId, gameRoomId });
				}
				socket.emit('game:invite:accepted', { inviteId, gameRoomId });
			} catch (error) {
				socket.emit('error', { message: error.message });
			}
		});

		socket.on('game:invite:decline', async ({ inviteId }) => {
			try {
				const invite = await db.getInvite(inviteId);
				if (!invite || invite.recipient_id !== socket.userId) {
					return socket.emit('error', { message: 'Invalid invite' });
				}
				await db.updateInviteStatus(inviteId, 'declined');
				const senderSocketId = socketManager.getSocketId(invite.sender_id);
				if (senderSocketId) {
					io.to(senderSocketId).emit('game:invite:declined', { inviteId });
				}
			} catch (error) {
				socket.emit('error', { message: error.message });
			}
		});

		/** tournament notification handler */
		socket.on('notification:read', async ({ notificationId }) => {
			try {
				await db.markNotificationRead(notificationId, socket.userId);
				socket.emit('notification:read:success', { notificationId });
			} catch (error) {
				socket.emit('error', { message: error.message });
			}
		});

		/** disconnection handler */
		socket.on('disconnect', () => {
			console.log(`User ${socket.userId} disconnected`);
			socketManager.removeUser(socket.id);
			socket.broadcast.emit('user:offline', { userId: socket.userId });
		});
	});
}