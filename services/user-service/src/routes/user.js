import fs from 'fs';
import path from 'path';

const isDocker = process.env.DOCKER_ENV === 'true';
const uploadDir = isDocker ? '/app/uploads' : path.join(path.resolve(), 'uploads');
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

export default async function userRoutes(fastify, options) {
	const dbService = fastify.db;

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
			try {
				const profile = await dbService.createProfile({ user_id, username, bio });
				reply.send(profile);
			} catch (err) {
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
			try {
				const profile = await dbService.getProfile(user_id);
				if (!profile) {
					return reply.code(404).send({ error: 'Profile not found' });
				}
				const updatedProfile = await dbService.updateProfile(user_id, { username, bio });
				reply.send(updatedProfile);
			} catch (err) {
				req.log.error(err);
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
					return reply.code(404).send({ error: 'Photo not found' });
				}
				reply.send(photo);
			} catch (err) {
				req.log.error(err);
				reply.code(500).send({ error: 'Failed to fetch photo' });
			}
		}
	});
}