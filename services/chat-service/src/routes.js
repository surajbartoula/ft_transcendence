export function setupRoutes(fastify) {
	const { db, socketManager } = fastify;

	/** chat routes */
	fastify.post('/send', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		try {
			const { receipientId, content, type = 'text'} = request.body;
			const senderId = request.user.id;
			const isBlocked = await db.isBlocked(receipientId, senderId);
			if (isBlocked) {
				return reply.code(403).send({ error: 'You are blocked by this user'});
			}
			const message = await db.saveMessage(senderId, receipientId, content, type);
			return { success: true, message };
		} catch (error) {
			return reply.code(400).send({ error: error.message });
		}
	});

	fastify.get('/history/:userId', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		const { userId } = request.params;
		const currentUserId = request.user.id;
		const messages = await db.getMessages(currentUserId, parseInt(userId));
		return { success: true, messages };
	});

	fastify.put('/read/:messageId', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		const { messageId } = request.params;
		await db.markAsRead(parseInt(messageId), request.user.id);
		return { success: true };
	});

	/** Block routes */
	fastify.post('/block/:userId', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		const { userId } = request.params;
		const blockerId = request.user.id;
		if (parseInt(userId) === blockerId) {
			return reply.code(400).send({ error: 'Cannot block yourself' });
		}
		await db.blockUser(blockerId, parseInt(userId));
		/** notify blocked user if online */
		const socketId = socketManager.getSocketId(parseInt(userId));
		if (socketId) {
			fastify.io.to(socketId).emit('user:blocked', { by: blockerId });
		}
		return { success: true };
	});

	fastify.delete('/block/:userId', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		const { userId } = request.params;
		await db.unblockUser(request.user.id, parseInt(userId));
		return { success: true };
	});

	fastify.get('/block/list', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		const blockedUsers = await db.getBlockedUsers(request.user.id);
		return { success: true, blockedUsers };
	});

	fastify.post('/game/invite/:userId', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		try {
			const { userId: receipientId } = request.params;
			const senderId = request.user.id;
			const isBlocked = await db.isBlocked(parseInt(receipientId), senderId);
			if (isBlocked) {
				return reply.code(403).send({ error: 'You are blocked by this user' });
			}
			const invite = await db.createGameInvite(senderId, parseInt(receipientId));
			return { success: true, invite };
		} catch (error) {
			return reply.code(400).send({ error: error.message });
		}
	});

	fastify.get('/game/invites', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		const invites = await db.getPendingInvites(request.user.id);
		return { success: true, invites };
	});

	/** profile routes */
	fastify.get('/profile/:userId', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		const { userId } = request.params;
		const user = await db.getUser(parseInt(userId));
		if (!user) {
			return reply.code(404).send({ error: 'User not found' });
		}
		const isOnline = socketManager.isUserOnline(parseInt(userId));
		return { success: true, user: { ...user, isOnline }};
	});

	/** tournament routes */
	fastify.post('/tournament/notify', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		try {
			const { tournamentId, userId, message, type } = request.body;
			const notificationId = await db.createNotification(tournamentId, userId, message, type);
			/** send real-time notification if user is online */
			const socketId = socketManager.getSocketId(userId);
			if (socketId) {
				fastify.io.to(socketId).emit('tournament:notification', {
					id: notificationId,
					tournamentId,
					message,
					type,
					createdAt: new Date()
				});
			}
			return { success: true, notificationId };
		} catch (error) {
			return reply.code(500).send({ error: error.message });
		}
	});

	fastify.get('/tournament/notifications', {
		preValidation: [fastify.authenticate]
	}, async (request, reply) => {
		const notification = await db.getNotifications(request.user.id);
		return { success: true, notification };
	});
}