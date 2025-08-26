import fs from 'fs';
import path from 'path';

const isDocker = process.env.DOCKER_ENV === 'true';
const uploadDir = isDocker ? '/app/uploads' : path.join(path.resolve(), 'uploads');
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

export default async function userRoutes(fastify, options) {
	const dbService = fastify.db;

	// Check username availability (public endpoint for registration)
	fastify.get('/username/check/:username', async (req, reply) => {
		try {
			const { username } = req.params;
			
			if (!username || username.trim().length < 3) {
				return reply.code(400).send({ 
					error: 'Username must be at least 3 characters long' 
				});
			}
			
			if (username.length > 20) {
				return reply.code(400).send({ 
					error: 'Username must be no more than 20 characters long' 
				});
			}
			
			const exists = await dbService.isUsernameExists(username.trim());
			
			reply.send({
				username: username.trim(),
				available: !exists,
				exists: exists
			});
		} catch (error) {
			req.log.error(error);
			reply.code(500).send({ error: 'Failed to check username availability' });
		}
	});

	fastify.post('/profile', {
		preHandler: fastify.authenticate,
		handler: async (req, reply) => {
			const user_id = req.user.sub || req.user.user_id || req.user.id;
			const { username, bio } = req.body;
			if (!user_id) {
				return reply.code(400).send({ error: 'user_id is required' });
			}
			if (!username) {
				return reply.code(400).send({ error: 'username is required'});
			}
			if (username.length < 3) {
				return reply.code(400).send({ error: 'Username must be at least 3 characters long' });
			}
			if (username.length > 20) {
				return reply.code(400).send({ error: 'Username must be no more than 20 characters long' });
			}
			try {
				const profile = await dbService.createProfile({ user_id, username: username.trim(), bio });
				// Return profile with default photo information
				const profileWithPhoto = await dbService.getProfileWithPhoto(user_id);
				reply.send(profileWithPhoto);
			} catch (err) {
				req.log.error(err);
				if (err.message === 'Username already exists') {
					return reply.code(409).send({ error: 'Username already exists' });
				}
				if (err.message === 'Profile already exists for this user') {
					return reply.code(409).send({ error: 'Profile already exists for this user' });
				}
				reply.code(500).send({ error: 'Failed to create profile' });
			}
		}
	});

	fastify.get('/profile', {
		preHandler: fastify.authenticate,
		handler: async (req, reply) => {
			const user_id = req.user.sub || req.user.user_id || req.user.id;
			try {
				const profile = await dbService.getProfileWithPhoto(user_id);
				if (!profile) {
					return reply.code(404).send({ error: 'Profile not found'} );
				}
				reply.send(profile);
			} catch (err) {
				req.log.error(err);
				reply.code(500).send({ error: 'Failed to fetch profile' });
			}
		}
	});

	fastify.patch('/profile', {
		preHandler: fastify.authenticate,
		handler: async (req, reply) => {
			const user_id = req.user.sub || req.user.user_id || req.user.id;
			const { username, bio } = req.body;
			
			// Validate username if provided
			if (username !== undefined) {
				if (username.length < 3) {
					return reply.code(400).send({ error: 'Username must be at least 3 characters long' });
				}
				if (username.length > 20) {
					return reply.code(400).send({ error: 'Username must be no more than 20 characters long' });
				}
			}
			
			try {
				const profile = await dbService.getProfile(user_id);
				if (!profile) {
					return reply.code(404).send({ error: 'Profile not found' });
				}
				
				const updates = {};
				if (username !== undefined) updates.username = username.trim();
				if (bio !== undefined) updates.bio = bio;
				
				const updatedProfile = await dbService.updateProfile(user_id, updates);
				reply.send(updatedProfile);
			} catch (err) {
				req.log.error(err);
				if (err.message === 'Username already exists') {
					return reply.code(409).send({ error: 'Username already exists' });
				}
				reply.code(500).send({ error: 'Failed to update profile' });
			}
		}
	});

	fastify.post('/photo', {
		preHandler: fastify.authenticate,
		handler: async (req, reply) => {
			const user_id = req.user.sub || req.user.user_id || req.user.id;
			try {
				const profile = await dbService.getProfile(user_id);
				if (!profile) {
					return reply.code(404).send({ error: 'Profile not found' });
				}
				const data = await req.file();
				if (!data) {
					return reply.code(400).send({ error: 'No file uploaded' });
				}
				const filename = Date.now() + '-' + data.filename;
				const filePath = path.join(uploadDir, filename);
				await new Promise((resolve, reject) => {
					const writeStream = fs.createWriteStream(filePath);
					data.file.pipe(writeStream);
					data.file.on('end', resolve);
					data.file.on('error', reject);
				});
				const photo = await dbService.addOrUpdatePhoto({
					user_id,
					filename,
					path: `/uploads/${filename}`
				});
				reply.send(photo);
			} catch (err) {
				req.log.error(err);
				reply.code(500).send({ error: 'Failed to upload photo'});
			}
		}
	});

	fastify.get('/photo', {
		preHandler: fastify.authenticate,
		handler: async (req, reply) => {
			const user_id = req.user.sub || req.user.user_id || req.user.id;
			try {
				const photo = await dbService.getPhoto(user_id);
				if (!photo) {
					// Return default avatar when no user photo exists
					return reply.send({
						filename: 'avatar.jpg',
						path: '/assets/avatar.jpg',
						uploaded_at: null,
						is_default: true
					});
				}
				reply.send({ ...photo, is_default: false });
			} catch (err) {
				req.log.error(err);
				reply.code(500).send({ error: 'Failed to fetch photo' });
			}
		}
	});

	/** Updated search route with blocking functionality */
	fastify.get('/search', {
		preHandler: fastify.authenticate,
		handler: async (req, reply) => {
			try {
				const { q: query, limit = 20 } = req.query;
				const currentUserId = req.user.sub || req.user.user_id || req.user.id;
				if (!query || !query.trim()) {
					return reply.code(400).send({ 
						error: 'Query parameter "q" is required'
					});
				}
				if (!currentUserId) {
					return reply.code(401).send({ 
						error: 'User not authenticated' 
					});
				}
				/** Search users with blocking functionality */
				const searchResults = await dbService.searchUsers(
					query.trim(), 
					parseInt(limit), 
					currentUserId
				);
				return reply.send({
					success: true,
					users: searchResults,
					count: searchResults.length
				});
			} catch (error) {
				req.log.error(error);
				return reply.code(500).send({ 
					error: 'Search failed',
					message: 'Internal server error during search'
				});
			}
		}
	});

	fastify.get('/profile/:userId', {
		preHandler: fastify.authenticate,
		handler: async (req, reply) => {
			try {
				const { userId } = req.params;
				if (!userId) {
					return reply.code(400).send({ 
						error: 'User ID is required' 
					});
				}
				const profile = await dbService.getProfileWithPhoto(userId);
				if (!profile) {
					return reply.code(404).send({ 
						error: 'Profile not found' 
					});
				}
				return reply.send({
					success: true,
					...profile
				});
			} catch (error) {
				req.log.error(error);
				return reply.code(500).send({ 
					error: 'Failed to fetch user profile',
					message: error.message 
				});
			}
		}
	});

	/** Get multiple user profiles by IDs (batch request for efficiency) */
	fastify.post('/profiles/batch', {
		preHandler: fastify.authenticate,
		handler: async (req, reply) => {
			try {
				const { userIds } = req.body;
				
				if (!userIds || !Array.isArray(userIds)) {
					return reply.code(400).send({ 
						error: 'userIds array is required' 
					});
				}
				if (userIds.length === 0) {
					return reply.send({
						success: true,
						profiles: []
					});
				}
				if (userIds.length > 50) {
					return reply.code(400).send({ 
						error: 'Maximum 50 user IDs allowed per request' 
					});
				}
				const profiles = await dbService.getProfilesWithPhotos(userIds);
				return reply.send({
					success: true,
					profiles: profiles,
					count: profiles.length
				});
			} catch (error) {
				req.log.error(error);
				return reply.code(500).send({ 
					error: 'Failed to fetch user profiles',
					message: error.message 
				});
			}
		}
	});

}