export async function UserRoutes(fastify, options) {
	const { authenticate, db } = options;
	fastify.get('/profile/:userId', {
    	preHandler: authenticate
  		}, async (request, reply) => {
    	const { userId } = request.params;
    	const currentUserId = request.user.userId;
    	try {
      		const isBlocked = await db.isUserBlocked(currentUserId, userId);
      		if (isBlocked) {
        		return reply.code(403).send({ error: 'User profile not accessible' });
      		}
			/** This is a mock data need to integrate later with user-service */
			const userProfile = {
				id: userId,
				username: `user_${userId}`,
				avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
				status: 'online', /**Track from websocket and need to change this */
				stats: {
					gamesPlayed: 42,
					gamesWon: 28,
					winRate: 66.7,
					rank: 'Advanced'
				},
        		lastSeen: new Date().toISOString()
      		};
			return {
				success: true,
				data: userProfile
			};
		} catch (error) {
			fastify.log.error('Error fetching user profile:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
  	});

	fastify.get('/search', {
		preHandler: authenticate
	}, async (request, reply) => {
		const { q: query, limit = 10 } = request.query;
		const currentUserId = request.user.userId;
		if (!query || query.length < 2) {
			return reply.code(400).send({ error: 'Query must be at least 2 characters' });
		}
		try {
			/** Need to search from user-service and update this for now returning mock data*/
			const mockUsers = [
				{ id: '1', username: 'alice', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice' },
				{ id: '2', username: 'bob', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob' },
				{ id: '3', username: 'charlie', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie' },
				{ id: '4', username: 'diana', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana' },
				{ id: '5', username: 'eve', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=eve' }
			];
			const filteredUsers = mockUsers
			.filter(user => 
				user.username.toLowerCase().includes(query.toLowerCase()) && 
				user.id !== currentUserId
			)
			.slice(0, limit);
			const blockedUsers = await db.getBlockedUsers(currentUserId);
			const blockedIds = new Set(blockedUsers.map(u => u.blocked_id));
			const results = filteredUsers.filter(user => !blockedIds.has(user.id));
			return {
				success: true,
				data: results
			};
		} catch (error) {
			fastify.log.error('Error searching users:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	/**Get all the online users */
	fastify.get('/online', {
		preHandler: authenticate
		}, async (request, reply) => {
		try {
			/** below is mock data need to integrate with web socket */
			const onlineUsers = [
				{ id: '1', username: 'alice', status: 'online' },
				{ id: '2', username: 'bob', status: 'playing' },
				{ id: '3', username: 'charlie', status: 'online' }
			];
			return {
				success: true,
				data: onlineUsers
			};
		} catch (error) {
			fastify.log.error('Error fetching online users:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});
}