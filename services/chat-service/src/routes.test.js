import { jest } from '@jest/globals';
import Fastify from 'fastify';
import { setupRoutes } from './routes.js'; // replace with actual path

// Mocked database and socket manager
const mockDb = {
  isBlocked: jest.fn(),
  saveMessage: jest.fn(),
  getMessages: jest.fn(),
  markAsRead: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  getBlockedUsers: jest.fn(),
  createGameInvite: jest.fn(),
  getPendingInvites: jest.fn(),
  getUser: jest.fn(),
  createNotification: jest.fn(),
  getNotifications: jest.fn(),
};

const mockSocketManager = {
  getSocketId: jest.fn(),
  getOnlineUsersIds: jest.fn(),
  isUserOnline: jest.fn(),
};

describe('Chat Routes', () => {
  let fastify;

  beforeAll(async () => {
    fastify = Fastify();
    fastify.decorate('db', mockDb);
    fastify.decorate('socketManager', mockSocketManager);
    fastify.decorate('authenticate', async (request, reply) => {
      request.user = { id: 1 }; // Simulate authenticated user
    });
    fastify.decorate('io', { to: jest.fn().mockReturnThis(), emit: jest.fn() });

    setupRoutes(fastify);
    await fastify.ready();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => fastify.close());

  /** CHAT ROUTES **/

  test('POST /send should save a message', async () => {
    mockDb.isBlocked.mockResolvedValue(false);
    mockDb.saveMessage.mockResolvedValue({ id: 1, content: 'Hello' });

    const response = await fastify.inject({
      method: 'POST',
      url: '/send',
      payload: { receipientId: 2, content: 'Hello' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      message: { id: 1, content: 'Hello' },
    });
    expect(mockDb.saveMessage).toHaveBeenCalledWith(1, 2, 'Hello', 'text');
  });

  test('GET /history/:userId should return messages', async () => {
    mockDb.getMessages.mockResolvedValue([{ id: 1, content: 'Hi' }]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/history/2',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      messages: [{ id: 1, content: 'Hi' }],
    });
  });

  test('GET /online should return online users', async () => {
    mockSocketManager.getOnlineUsersIds.mockReturnValue([1, 2]);
    mockDb.getUser
      .mockResolvedValueOnce({ id: 1, username: 'User1' })
      .mockResolvedValueOnce({ id: 2, username: 'User2' });

    const response = await fastify.inject({
      method: 'GET',
      url: '/online',
    });

    const json = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.count).toBe(2);
    expect(json.data.users).toContainEqual({ id: 1, username: 'User1', isOnline: true });
  });

  test('PUT /read/:messageId should mark message as read', async () => {
    mockDb.markAsRead.mockResolvedValue(true);

    const response = await fastify.inject({
      method: 'PUT',
      url: '/read/10',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ success: true });
    expect(mockDb.markAsRead).toHaveBeenCalledWith(10, 1);
  });

  /** BLOCK ROUTES **/

  test('POST /block/:userId should block user', async () => {
    mockDb.blockUser.mockResolvedValue(true);

    const response = await fastify.inject({
      method: 'POST',
      url: '/block/2',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ success: true });
    expect(mockDb.blockUser).toHaveBeenCalledWith(1, 2);
  });

  test('DELETE /block/:userId should unblock user', async () => {
    mockDb.unblockUser.mockResolvedValue(true);

    const response = await fastify.inject({
      method: 'DELETE',
      url: '/block/2',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ success: true });
    expect(mockDb.unblockUser).toHaveBeenCalledWith(1, 2);
  });

  test('GET /block/list should return blocked users', async () => {
    mockDb.getBlockedUsers.mockResolvedValue([{ id: 2, username: 'User2' }]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/block/list',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      blockedUsers: [{ id: 2, username: 'User2' }],
    });
  });

  /** GAME ROUTES **/

  test('POST /game/invite/:userId should create a game invite', async () => {
    mockDb.isBlocked.mockResolvedValue(false);
    mockDb.createGameInvite.mockResolvedValue({ id: 123, recipient_id: 2 });

    const response = await fastify.inject({
      method: 'POST',
      url: '/game/invite/2',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      invite: { id: 123, recipient_id: 2 },
    });
    expect(mockDb.createGameInvite).toHaveBeenCalledWith(1, 2);
  });

  test('GET /game/invites should return pending invites', async () => {
    mockDb.getPendingInvites.mockResolvedValue([{ id: 1, sender_id: 2 }]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/game/invites',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      invites: [{ id: 1, sender_id: 2 }],
    });
  });

  /** PROFILE ROUTES **/

  test('GET /profile/:userId should return user profile with online status', async () => {
    mockDb.getUser.mockResolvedValue({ id: 2, username: 'User2' });
    mockSocketManager.isUserOnline.mockReturnValue(true);

    const response = await fastify.inject({
      method: 'GET',
      url: '/profile/2',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      user: { id: 2, username: 'User2', isOnline: true },
    });
  });

  test('GET /profile/:userId should return 404 if user not found', async () => {
    mockDb.getUser.mockResolvedValue(null);

    const response = await fastify.inject({
      method: 'GET',
      url: '/profile/99',
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.payload)).toEqual({ error: 'User not found' });
  });

  /** TOURNAMENT ROUTES **/

  test('POST /tournament/notify should create notification', async () => {
    mockDb.createNotification.mockResolvedValue(100);
    mockSocketManager.getSocketId.mockReturnValue('socket123');

    const response = await fastify.inject({
      method: 'POST',
      url: '/tournament/notify',
      payload: {
        tournamentId: 1,
        userId: 2,
        message: 'You have a match!',
        type: 'info',
      },
    });

    const data = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(data.success).toBe(true);
    expect(data.notificationId).toBe(100);
    expect(mockDb.createNotification).toHaveBeenCalled();
    expect(fastify.io.to).toHaveBeenCalledWith('socket123');
  });

  test('GET /tournament/notifications should return notifications', async () => {
    mockDb.getNotifications.mockResolvedValue([{ id: 1, message: 'Test' }]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/tournament/notifications',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      notification: [{ id: 1, message: 'Test' }],
    });
  });
});
