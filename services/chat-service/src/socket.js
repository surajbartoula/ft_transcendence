export class SocketManager {
	constructor() {
		this.users = new Map(); /** Store userId -> socketId */
		this.sockets = new Map(); /** socketId -> userId */
	}

	addUser(userId, socketId) {
		const oldSocketId = this.users.get(userId);
		if (oldSocketId) {
			this.sockets.delete(oldSocketId);
		}
		this.users.set(userId, socketId);
		this.sockets.set(socketId, userId);
	}

	removeUser(socketId) {
		const userId = this.sockets.get(socketId);
		if (userId) {
			this.users.delete(userId);
			this.sockets.delete(socketId);
		}
	}

	getSocketId(userId) {
		return this.users.get(userId);
	}

	getUserId(socketId) {
		return this.sockets.get(socketId);
	}

	isUserOnline(userId) {
		return this.users.has(userId);
	}
}