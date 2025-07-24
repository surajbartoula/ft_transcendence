import { SocketManager } from './socket.js';

describe('SocketManager', () => {
	let manager;

	beforeEach(() => {
		manager = new SocketManager();
	});

	test('should add a user and retrieve its socketId', () => {
		manager.addUser(1, 'socket123');
		expect(manager.getSocketId(1)).toBe('socket123');
		expect(manager.isUserOnline(1)).toBe(true);
	});

	test('should replace old socketId when user reconnects', () => {
		manager.addUser(1, 'socket123');
		manager.addUser(1, 'socket456');
		expect(manager.getSocketId(1)).toBe('socket456');
		expect(manager.getUserId('socket123')).toBeUndefined();
		expect(manager.getUserId('socket456')).toBe(1);
	});

	test('should remove a user using socketId', () => {
		manager.addUser(1, 'socket123');
		manager.removeUser('socket123');
		expect(manager.getSocketId(1)).toBeUndefined();
		expect(manager.isUserOnline(1)).toBe(false);
	});

	test('should return undefined for non-existent user/socket', () => {
		expect(manager.getSocketId(99)).toBeUndefined();
		expect(manager.getUserId('socket999')).toBeUndefined();
	});

	test('should return all online user IDs', () => {
		manager.addUser(1, 'socket123');
		manager.addUser(2, 'socket456');
		expect(manager.getOnlineUsersIds()).toEqual([1, 2]);
	});

	test('should return online users count', () => {
		manager.addUser(1, 'socket123');
		manager.addUser(2, 'socket456');
		expect(manager.getOnlineUsersCount()).toBe(2);
	});

	test('should return online users with socket mappings', () => {
		manager.addUser(1, 'socket123');
		manager.addUser(2, 'socket456');
		const users = manager.getOnlineUsersWithSockets();
		expect(users).toContainEqual({ userId: 1, socketId: 'socket123' });
		expect(users).toContainEqual({ userId: 2, socketId: 'socket456' });
	});

	test('should correctly check multiple users online status', () => {
		manager.addUser(1, 'socket123');
		const status = manager.checkMultipleUsersOnline([1, 2, 3]);
		expect(status).toEqual({ 1: true, 2: false, 3: false });
	});
});
