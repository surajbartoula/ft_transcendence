export class WebSocketHandler {
	constructor(database) {
		this.db = database;
		this.activeConnections = new Map();
		this.userSockets = new Map();
	}

	async handleConnection(connection, userId) {
		console.log(`User ${userId} connected`);
		this.activeConnections.set(userId, connection);
		this.userSockets.set(connection.socket, userId);
		await this.sendPendingGameInvites(userId);
		connection.socket.on('message', async (message) => {
			try {
				const data = JSON.parse(message);
				await this.handleMessage(data, userId);
			} catch (error) {
				console.error('WebSocket message error:', error);
				this.sendError(userId, 'Invalid message format');
			}
		});
		connection.socket.on('close', () => {
			console.log(`User ${userId} disconnected`);
			this.activeConnections.delete(userId);
			this.userSockets.delete(connection.socket);
		});
		this.sendToUser(userId, {
			type: 'connected',
			data: { userId, timestamp: new Date().toISOString() }
		});
	}

	async handleMessage(data, senderId) {
		switch (data.type) {
			case 'direct_message':
				await this.handleDirectMessage(data, senderId);
				break;
			case 'game_invite':
				await this.handleGameInvite(data, senderId);
				break;
			case 'game_invite_response':
				await this.handleGameInviteResponse(data, senderId);
				break;
			case 'mark_read':
				await this.handleMarkRead(data, senderId);
				break;
			case 'typing':
				await this.handleTyping(data, senderId);
				break;
			default:
				console.log('Unknown message type:', data.type);
		}
	}

	async handleDirectMessage(data, senderId) {
		const { recipientId, message, messageType = 'text' } = data;
		if (!recipientId || !message) {
			this.sendError(senderId, 'Missing required fields');
			return;
		}
		try {
			const isBlocked = await this.db.isUserBlocked(recipientId, senderId);
			if (isBlocked) return;
			const savedMessage = await this.db.saveMessage({
				senderId,
				recipientId,
				message,
				messageType
			});
			/**Send to recipient if online */
			this.sendToUser(recipientId, {
				type: 'new message',
				data: {
					id: savedMessage.id,
					senderId,
					recipientId,
					message: savedMessage.message,
					messageType: savedMessage.message_type,
					timestamp: savedMessage.timestamp
				}
			});
			/**confirm the sender that message is sent */
			this.sendToUser(senderId, {
				type: 'message_sent',
				data: {
					id: savedMessage.id,
					recipientId,
					message: savedMessage.message,
					messageType: savedMessage.message_type,
					timestamp: savedMessage.timestamp
				}
			});
		} catch (error) {
			console.error('Error handling direct message:', error);
			this.sendError(senderId, 'Failed to send message');
		}
	}

	async handleGameInvite(data, senderId) {
		const { recipientId, gameType = 'pong' } = data;
		if (!recipientId) {
			this.sendError(senderId, 'Missing recipient ID');
			return;
		}
		try {
			const isBlocked = await this.db.isUserBlocked(recipientId, senderId);
			if (isBlocked) return;
			const invite = await this.db.createGameInvite({
				senderId,
				recipientId,
				gameType
			});
			this.sendToUser(recipientId, {
				type: 'game_invite',
				data: {
					id: invite.id,
					senderId,
					gameType: invite.game_type,
					expiresAt: invite.expires_at,
					timestamp: invite.created_at
				}
			});
			this.sendToUser(senderId, {
				type: 'game_invite_send',
				data: {
					id: invite.id,
					recipientId,
					gameType: invite.game_type,
					expiresAt: invite.expires_at
				}
			});
		} catch (error) {
			console.error('Error handling game invite:', error);
			this.sendError(senderId, 'Failed to send game invite');
		}
	}

	async handleGameInviteResponse(data, userId) {
		const { inviteId, response } = data;
		/**If inviteId is missing or if response is not 'accept' or 'decline' then run the block*/
		if (!inviteId || !['accept', 'decline'].includes(response)) {
			this.sendError(userId, 'Invalid response data');
			return;
		}
		try {
			/**Get invite details */
			const invite = await this.db.getGameInvite(inviteId);
			if (!invite) {
				this.sendError(userId, 'Invite not found or expired');
				return;
			}
			if (invite.recipientId != userId) {
				this.sendError(userId, 'Unathorized');
				return;
			}
			/**Update invite status */
			const status = response === 'accept' ? 'accepted' : 'declined';
			await this.db.updateGameInviteStatus(inviteId, status);
			/**Notify sender */
			this.sendToUser(invite.sender_id, {
				type: 'game_invite_response',
				data: {
					inviteId,
					response,
					responseId: userId,
					gameType: invite.game_type
				}
			});
			if (response === 'accept') {
				const gameData = {
					type: 'game_start',
					data: {
						gameId: `game_${inviteId}`,
						gameType: invite.game_type,
						players: [invite.sender_id, userId],
						timestamp: new Date().toISOString()
					}
				};
				this.sendToUser(invite.sender_id, gameData);
				this.sendToUser(userId, gameData);
			}
		} catch (error) {
			console.error('Error handling game invite response:', error);
			this.sendError(userId, 'Failed to process response');
		}
	}

	async handleMarkRead(data, userId) {
		const { otherUserId } = data;
		if (!otherUserId) {
			this.sendError(userId, 'Missing other user ID');
			return;
		}
		try {
			await this.db.markMessageAsRead(otherUserId, userId);
			this.sendToUser(userId, {
				type: 'message_marked_read',
				data: { otherUserId }
			});
		} catch (error) {
			console.error('Error marking messages as read:', error);
			this.sendError(userId, 'Failed to mark messages as read');
		}
	}

	async handleTyping(data, senderId) {
		const {recipientId, isTyping } = data;
		if (!recipientId) return;
		/** Send typing indicator to recipient */
		const isBlocked = await this.db.isUserBlocked(recipientId, senderId);
		if (isBlocked) return;
		this.sendToUser(recipientId, {
			type: 'typing',
			data: {
				senderId,
				isTyping
			}
		});
	}

	async sendPendingGameInvites(userId) {
		try {
			const invites = await this.db.getPendingGameInvites(userId);
			for (const invite of invites) {
				this.sendToUser(userId, {
					type: 'game_invite',
					data: {
						id: invite.id,
						senderId: invite.sender_id,
						gameType: invite.game_type,
						expiresAt: invite.expires_at,
						timestamp: invite.created_at
					}
				});
			}
		} catch (error) {
			console.error('Error sending pending game invites:', error);
		}
	}

	/** Tournament notification method */
	async notifyTournamentUpdate(userId, tournamentData) {
		this.sendToUser(userId, {
			type: 'tournament_notification',
			data: tournamentData
		});
	}

	/**
	 * All the utility methods below
	 */
	sendToUser(userId, data) {
		const connection = this.activeConnections.get(userId);
		if (connection && connection.socket.readyState === 1) {
			connection.socket.send(JSON.stringify(data));
			return true;
		}
		return false;
	}

	sendError(userId, message) {
		this.sendToUser(userId, {
			type: 'error',
			data: { message }
		});
	}

	broadcast(data, excludeUserId = null) {
		for (const [userId, connection] of this.activeConnections) {
			if (userId != excludeUserId && connection.socket.readyState === 1) {
				connection.socket.send(JSON.stringify(data));
			}
		}
	}

	getOnlineUsers() {
		return Array.from(this.activeConnections.keys());
	}

	isUserOnline(userId) {
		return this.activeConnections.has(userId);
	}
}