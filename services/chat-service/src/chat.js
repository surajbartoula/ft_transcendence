import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export async function ChatRoutes(fastify, options) {
	const { authenticate, db } = options;

	/** Get direct messages between 2 users */
	fastify.get('/direct/:userId', {
		preHandler: authenticate
	}, async (request, reply) => {
		const { userId: otherUserId } = request.params;
		const { page = 1, limit = 50 } = request.query;
		const currentUserId = request.user.userId;
		try {
			const isBlocked = await db.isUserBlocked(currentUserId, otherUserId);
			if (isBlocked) return reply.code(403).send({ error: 'User is blocked' });
			/** Since type coercion will happen convert first to integer */
			const pageNum = Math.max(1, parseInt(page) || 1); //pageNum is always 1 or greater
			const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50)); //limit between 1 to 100

			const offset = (pageNum - 1) * limitNum;
			const messages = await db.getDirectMessages(currentUserId, otherUserId, limitNum, offset);
			await db.markMessagesAsRead(otherUserId, currentUserId);
			return {
				success: true,
				data: {
					messages,
					pagination: {
						page: pageNum,
						limit: limitNum,
						hasMore: messages.length === limitNum
					}
				}
			}
		} catch (error) {
			fastify.log.error('Error fetching blocked users:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	/** Get recent chats for a user */
	fastify.get('/recent', {
		preHandler: authenticate
	}, async (request, reply) => {
		const { limit = 20 } = request.query;
		const userId = request.user.userId;
		try {
			const recentChats = await db.getRecentChats(userId, limit);
			return {
				success: true,
				data: recentChats
			};
		} catch (error) {
			fastify.log.error('Error fetching recent chats:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	/** Send direct message via HTTP (alternative to WebSocket) */
	fastify.post('/direct', {
		preHandler: authenticate
	}, async (request, reply) => {
		const { recipientId, message, messageType = 'text' } = request.body;
		const senderId = request.user.userId;
		if (!recipientId || !message) {
			return reply.code(400).send({ error: 'Missing required fields' });
		}
		try {
			const isBlocked = await db.isUserBlocked(recipientId, senderId);
			if (isBlocked) {
				return reply.code(403).send({ error: 'Cannot send message to this user' });
			}
			const savedMessage = await db.savedMessage({
				senderId,
				recipientId,
				roomId: null,
				message,
				messageType
			});
			return {
				success: true,
				data: savedMessage
			};
		} catch (error) {
			fastify.log.error('Error sending message:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	/** Send game invite via HTTP */
	fastify.post('/game-invite', {
		preHandler: authenticate
	}, async (request, reply) => {
		const {recipientId, gameType = 'pong' } = request.body;
		const senderId = request.user.userId;
		if (!recipientId) {
			return reply.code(400).send({ error: 'Missing recipient ID' });
		}
		if (recipientId === senderId) {
			return reply.code(400).send({ error: 'Cannot invite yourself' });
		}
		try {
			const isBlocked = await db.isUserBlocked(recipientId, senderId);
			if (isBlocked) {
				return reply.code(403).send({ error: 'Cannot send invite to this user' });
			}
			const invite = await db.createGameInvite({
				senderId,
				recipientId,
				gameType
			});
			return {
				success: true,
				data: invite
			};
		} catch (error) {
			fastify.log.error('Error sending game invite:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	/** Get pending game invites */
	fastify.get('/game-invites', {
		preHandler: authenticate
	}, async (request, reply) => {
		const userId = request.user.userId;
		try {
			const invites = await db.getPendingGameInvites(userId);
			return {
				success: true,
				data: invites
			};
		} catch (error) {
			fastify.log.error('Error fetching game invites:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	/** Respond to game invite */
	fastify.post('/game-invite/:inviteId/respond', {
		preHandler: authenticate
	}, async (request, reply) => {
		const { inviteId } = request.params;
		const { response } = request.body; //accept or decline
		const userId = request.user.userId;
		if (!['accept', 'decline'].includes(response)) {
			return reply.code(400).send({ error: 'Invalid response' });
		}
		try {
			/** Get invite details */
			const invite = await db.getGameInvite(inviteId);
			if (!invite) {
				return reply.code(404).send({ error: 'Invite not found or expired' });
			}
			if (invite.recipient_id !== userId) {
				return reply.code(403).send({ error: 'Unauthorized' });
			}
			/** Update invite status */
			const status = response === 'accept' ? 'accepted' : 'declined';
			await db.updateGameInviteStatus(inviteId, status);
			return {
				success: true,
				data: {
					inviteId,
					response,
					status
				}
			};
		} catch (error) {
			fastify.log.error('Error responding to game invite:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	/** Clean up expired invites (for admin) */
	fastify.post('/cleanup-invites', async (request, reply) => {
		const { authorization } = request.headers;
		if (!authorization) return reply.code(401).send({ error: 'Authorization header required' });
		if (!authorization.startsWith('Bearer ')) {
			return reply.code(401).send({ error: 'Invalid authorization format' });
		}
		const token = authorization.slice(7); //remove Bearer prefix
		if (token !== process.env.ADMIN_TOKEN) {
			return reply.code(401).send({ error: 'Invalid token' });
		}
		try {
			const result = await db.cleanupExpiredInvites();
			return {
				success: true,
				message: `Cleaned up ${result.changes} expired invites`
			};
		} catch (error) {
			fastify.log.error('Error cleaning up invites:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	// Don't forget to attach Bearer on body of JSON request like below eg
	// async function cleanupExpiredInvites() {
	// const response = await fetch('/cleanup-invites', {
	// 	method: 'POST',
	// 	headers: {
	// 	'Authorization': `Bearer ${ADMIN_TOKEN}`,
	// 	'Content-Type': 'application/json'
	// 	}
	// });
	
	// const result = await response.json();
	// console.log(result);
	// }

	fastify.post('/block', {
		preHandler: authenticate
	}, async (request, reply) => {
		const { userId: blockedId } = request.body;
		const blockerId = request.user.userId;
		if (!blockedId) {
			return reply.code(400).send({ error: 'Missing user ID' });
		}
		if (blockedId === blockerId) {
			return reply.code(400).send({ error: 'Cannot block yourself' });
		}
		try {
			await db.blockUser(blockerId, blockedId);
			return {
				success: true,
				message: 'User blocked successfully'
			};
		} catch (error) {
			fastify.log.error('Error blocking user:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	fastify.post('/unblock', {
		preHandler: authenticate
	}, async (request, reply) => {
		const { userId: blockedId } = request.body;
		const blockerId = request.user.userId;
		if (!blockedId) {
			return reply.code(400).send({ error: 'Missing user ID' });
		}
		try {
			const result = await db.unblockUser(blockerId, blockedId);
			if (result.changes === 0) {
				return reply.code(404).send({ error: 'User was not blocked' });
			}
			return {
				success: true,
				message: 'User unblocked successfully'
			};
		} catch (error) {
			fastify.log.error('Error unblocking user:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	fastify.get('/blocked', {
		preHandler: authenticate
	}, async (request, reply) => {
		const userId = request.user.userId;
		try {
			const blockedUsers = await db.getBlockedUsers(userId);
			return {
				success: true,
				data: blockedUsers
			};
		} catch (error) {
			fastify.log.error('Error fetching blocked users:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});
}