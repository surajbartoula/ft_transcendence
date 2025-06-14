export default async function userRoutes(fastify, options) {
	const createDefaultProfile = async (user_id, userInfo = {}) => {
		const defaultProfile = {
			user_id: user_id,
			username: userInfo.email?.split('@')[0] || `user_${user_id.substring(0, 8)}`,
			email: userInfo.email || '',
			avatar_url: userInfo.avatar_url || '',
			bio: '',
			location: '',
			games_played: 0,
			games_won: 0,
			total_score: 0,
			best_score: 0,
			level: 1,
			experience_points: 0,
			win_rate: 0
		};
		
		try {
			return await fastify.db.createUserProfile(defaultProfile);
		} catch (error) {
			if (error.code === 'SQLITE_CONSTRAINT') {
				// Profile already exists, fetch it
				return await fastify.db.getUserProfile(user_id);
			}
			throw error;
		}
	};

	fastify.get('/profile', {
		schema: {
			tags: ['user'],
			summary: 'Get user profile',
			security: [{ bearerAuth: [] }],
			response: {
				200: {
					type: 'object',
					properties: {
						user_id: { type: 'string' },
						username: { type: 'string' },
						email: { type: 'string' },
						avatar_url: { type: 'string' },
						bio: { type: 'string' },
						location: { type: 'string' },
						games_played: { type: 'number'},
						games_won: { type: 'number'},
						total_score: { type: 'number'},
						best_score: { type: 'number'},
						level: { type: 'number'},
						experience_points: { type: 'number'},
						win_rate: { type: 'number'},
						created_at: { type: 'string' },
						updated_at: { type: 'string' },
						last_seen: { type: 'string' }
					}
				}
		}
	},
	preHandler: fastify.authenticate,
	handler: async (request, reply) => {
		try {
			const user_id = request.user.sub || request.user.user_id || request.user.id;
			let profile = await fastify.db.getUserProfile(user_id);
			
			// If profile doesn't exist, create it automatically
			if (!profile) {
				fastify.log.info(`Creating profile for new user: ${user_id}`);
				profile = await createDefaultProfile(user_id, request.user);
			}
			
			// Update last seen
			await fastify.db.updateLastSeen(user_id);
			return profile;
		} catch (error) {
			fastify.log.error('Error fetching user profile:', error);
			return reply.code(500).send({ error: 'Internal server error'});
		}
	}
	});

	/** Update user profile */
	fastify.put('/profile', {
		schema: {
			tags: ['user'],
			summary: 'Update user profile',
			security: [{ bearerAuth: [] }],
			body: {
				type: 'object',
				properties: {
					username: { type: 'string', minLength: 3, maxLength: 50 },
					email: { type: 'string', format: 'email' },
					avatar_url: {type: 'string', format: 'uri' },
					bio: { type: 'string', maxLength: 500 },
					location: { type: 'string', maxLength: 100 }
				}
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const user_id = request.user.sub || request.user.user_id || request.user.id;
				
				// Ensure profile exists before updating
				let profile = await fastify.db.getUserProfile(user_id);
				if (!profile) {
					profile = await createDefaultProfile(user_id, request.user);
				}
				
				const updatedProfile = await fastify.db.updateUserProfile(user_id, request.body);
				return updatedProfile;
			} catch (error) {
				if (error.code === 'SQLITE_CONSTRAINT') {
					return reply.code(409).send({ error: 'Username or email already exists' });
				}
				fastify.log.error('Error updating user profile:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	/** Get user stats */
	fastify.get('/stats', {
		schema: {
			tags: ['user'],
			summary: 'Get user statistics',
			security: [{ bearerAuth: [] }],
			response: {
				200: {
					type: 'object',
					properties: {
						user_id: { type: 'string' },
						games_played: { type: 'number' },
						games_won: { type: 'number' },
						total_score: { type: 'number' },
						best_score: { type: 'number' },
						level: { type: 'number' },
						experience_points: { type: 'number' },
						win_rate: { type: 'number' },
						created_at: { type: 'string' },
						updated_at: { type: 'string' }
					}
				}
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const user_id = request.user.sub || request.user.user_id || request.user.id;
				let stats = await fastify.db.getUserStats(user_id);
				
				// If stats don't exist, create profile first
				if (!stats) {
					const profile = await createDefaultProfile(user_id, request.user);
					stats = await fastify.db.getUserStats(user_id) || profile;
				}
				
				return stats;
			} catch (error) {
				fastify.log.error('Error fetching user stats:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	/** Update user stats */
	fastify.put('/stats', {
	    schema: {
			tags: ['user'],
			summary: 'Update user statistics',
			security: [{ bearerAuth: [] }],
			body: {
				type: 'object',
				properties: {
					games_played: { type: 'number', minimum: 0 },
					games_won: { type: 'number', minimum: 0 },
					total_score: { type: 'number', minimum: 0 },
					best_score: { type: 'number', minimum: 0 },
					level: { type: 'number', minimum: 1 },
					experience_points: { type: 'number', minimum: 0 }
				}
			}
			},
			preHandler: fastify.authenticate,
			handler: async (request, reply) => {
			try {
				const user_id = request.user.sub || request.user.user_id || request.user.id;
				/** Ensure profile exists before updating stats */
				let profile = await fastify.db.getUserProfile(user_id);
				if (!profile) {
					profile = await createDefaultProfile(user_id, request.user);
				}
				/** Calculate win rate if games_played and games_won are provided */
				const updateData = { ...request.body };
				if (updateData.games_played && updateData.games_won) {
					updateData.win_rate = updateData.games_played > 0 ? 
						(updateData.games_won / updateData.games_played) : 0;
				}
				
				const updatedStats = await fastify.db.updateUserStats(user_id, updateData);
				return updatedStats;
			} catch (error) {
				fastify.log.error('Error updating user stats:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	/** Get user achievements */
	fastify.get('/achievements', {
		schema: {
			tags: ['user'],
			summary: 'Get user achievements',
			security: [{ bearerAuth: [] }],
			response: {
				200: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { type: 'number' },
							name: { type: 'string' },
							description: { type: 'string' },
							icon: { type: 'string' },
							points: { type: 'number' },
							rarity: { type: 'string' },
							earned_at: { type: 'string' }
						}
					}
				}
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const user_id = request.user.sub || request.user.user_id || request.user.id;
				/** Ensure profile exists */
				let profile = await fastify.db.getUserProfile(user_id);
				if (!profile) {
					profile = await createDefaultProfile(user_id, request.user);
				}
				
				const achievements = await fastify.db.getUserAchievements(user_id);
				return achievements || [];
			} catch (error) {
				fastify.log.error('Error fetching user achievements:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	/** Award achievement to user */
	fastify.post('/achievements/:achievementId', {
		schema: {
			tags: ['user'],
			summary: 'Award achievement to user',
			security: [{ bearerAuth: [] }],
			params: {
				type: 'object',
				properties: {
				achievementId: { type: 'number' }
				},
				required: ['achievementId']
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const user_id = request.user.sub || request.user.user_id || request.user.id;
				const { achievementId } = request.params;
				/** Ensure profile exists */
				let profile = await fastify.db.getUserProfile(user_id);
				if (!profile) {
					profile = await createDefaultProfile(user_id, request.user);
				}
				
				const awarded = await fastify.db.awardAchievement(user_id, achievementId);
				if (!awarded) {
					return reply.code(409).send({ error: 'Achievement already earned' });
				}
				return { message: 'Achievement awarded successfully' };
			} catch (error) {
				fastify.log.error('Error awarding achievement:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	fastify.get('/achievements/all', {
		schema: {
			tags: ['user'],
			summary: 'Get all available achievements',
			security: [{ bearerAuth: [] }],
			response: {
				200: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						id: { type: 'number' },
						name: { type: 'string' },
						description: { type: 'string' },
						icon: { type: 'string' },
						points: { type: 'number' },
						rarity: { type: 'string' },
						created_at: { type: 'string' }
					}
				}
				}
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
		try {
			const achievements = await fastify.db.getAllAchievements();
			return achievements || [];
		} catch (error) {
			fastify.log.error('Error fetching achievements:', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
		}
	});

	fastify.get('/friends', {
		schema: {
			tags: ['user'],
			summary: 'Get user friends',
			security: [{ bearerAuth: [] }],
			response: {
				200: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							user_id: { type: 'string' },
							username: { type: 'string' },
							avatar_url: { type: 'string' },
							last_seen: { type: 'string' },
							status: { type: 'string' },
							friend_since: { type: 'string' }
						}
					}
				}
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const user_id = request.user.sub || request.user.user_id || request.user.id;
				/** Ensure profile exists */
				let profile = await fastify.db.getUserProfile(user_id);
				if (!profile) {
					profile = await createDefaultProfile(user_id, request.user);
				}
				
				const friends = await fastify.db.getFriends(user_id);
				return friends || [];
			} catch (error) {
				fastify.log.error('Error fetching friends:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	/** Send friend request */
	fastify.post('/friends/request', {
		schema: {
			tags: ['user'],
			summary: 'Send friend request',
			security: [{ bearerAuth: [] }],
			body: {
				type: 'object',
				properties: {
					recipient_id: { type: 'string' }
				},
				required: ['recipient_id']
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const requester_id = request.user.sub || request.user.user_id || request.user.id;
				const { recipient_id } = request.body;
				
				if (requester_id === recipient_id) {
					return reply.code(400).send({ error: 'Cannot send friend request to yourself' });
				}
				/** Ensure both profiles exist */
				let requesterProfile = await fastify.db.getUserProfile(requester_id);
				if (!requesterProfile) {
					requesterProfile = await createDefaultProfile(requester_id, request.user);
				}
				
				await fastify.db.sendFriendRequest(requester_id, recipient_id);
				return { message: 'Friend request sent successfully' };
			} catch (error) {
				if (error.code === 'SQLITE_CONSTRAINT') {
					return reply.code(409).send({ error: 'Friend request already exists' });
				}
				fastify.log.error('Error sending friend request:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	/** Respond to friend request */
	fastify.put('/friends/request/:requesterId', {
		schema: {
			tags: ['user'],
			summary: 'Respond to friend request',
			security: [{ bearerAuth: [] }],
			params: {
				type: 'object',
				properties: {
					requesterId: { type: 'string' }
				},
				required: ['requesterId']
			},
			body: {
				type: 'object',
				properties: {
					status: { type: 'string', enum: ['accepted', 'rejected'] }
				},
				required: ['status']
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const recipient_id = request.user.sub || request.user.user_id || request.user.id;
				const { requesterId } = request.params;
				const { status } = request.body;
				
				let profile = await fastify.db.getUserProfile(recipient_id);
				if (!profile) {
					profile = await createDefaultProfile(recipient_id, request.user);
				}
				
				await fastify.db.updateFriendshipStatus(requesterId, recipient_id, status);
				return { message: `Friend request ${status} successfully` };
			} catch (error) {
				fastify.log.error('Error responding to friend request:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	/** Get friend request */
	fastify.get('/friends/requests', {
		schema: {
			tags: ['user'],
			summary: 'Get pending friend requests',
			security: [{ bearerAuth: [] }],
			response: {
				200: {
				type: 'array',
				items: {
						type: 'object',
						properties: {
							user_id: { type: 'string' },
							username: { type: 'string' },
							avatar_url: { type: 'string' },
							requested_at: { type: 'string' }
						}
					}
				}
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const user_id = request.user.sub || request.user.user_id || request.user.id;
				let profile = await fastify.db.getUserProfile(user_id);
				if (!profile) {
					profile = await createDefaultProfile(user_id, request.user);
				}
				
				const requests = await fastify.db.getFriendRequests(user_id);
				return requests || [];
			} catch (error) {
				fastify.log.error('Error fetching friend requests:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	/** Add game sessions */
	fastify.post('/games/session', {
		schema: {
		tags: ['user'],
		summary: 'Add game session',
		security: [{ bearerAuth: [] }],
			body: {
				type: 'object',
				properties: {
					game_type: { type: 'string' },
					score: { type: 'number', minimum: 0 },
					duration: { type: 'number', minimum: 0 },
					completed: { type: 'boolean' }
				},
				required: ['game_type', 'score', 'duration', 'completed']
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const user_id = request.user.sub || request.user.user_id || request.user.id;
				const { game_type, score, duration, completed } = request.body;
				let profile = await fastify.db.getUserProfile(user_id);
				if (!profile) {
					profile = await createDefaultProfile(user_id, request.user);
				}
				
				await fastify.db.addGameSession(user_id, game_type, score, duration, completed);
				/** Update user stats after adding game session */
				const currentStats = await fastify.db.getUserStats(user_id);
				const newStats = {
					games_played: (currentStats.games_played || 0) + 1,
					games_won: (currentStats.games_won || 0) + (completed ? 1 : 0),
					total_score: (currentStats.total_score || 0) + score,
					best_score: Math.max(currentStats.best_score || 0, score)
				};
				newStats.win_rate = newStats.games_played > 0 ? (newStats.games_won / newStats.games_played) : 0;
				
				await fastify.db.updateUserStats(user_id, newStats);
				
				return { message: 'Game session recorded successfully' };
			} catch (error) {
				fastify.log.error('Error adding game session:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	fastify.get('/games/recent', {
		schema: {
			tags: ['user'],
			summary: 'Get recent games',
			security: [{ bearerAuth: [] }],
			querystring: {
				type: 'object',
				properties: {
					limit: { type: 'number', minimum: 1, maximum: 50, default: 10 }
				}
			},
			response: {
				200: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { type: 'number' },
							user_id: { type: 'string' },
							game_type: { type: 'string' },
							score: { type: 'number' },
							duration: { type: 'number' },
							completed: { type: 'boolean' },
							created_at: { type: 'string' }
						}
					}
				}
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const user_id = request.user.sub || request.user.user_id || request.user.id;
				const limit = request.query.limit || 10;
				
				// Ensure profile exists
				let profile = await fastify.db.getUserProfile(user_id);
				if (!profile) {
					profile = await createDefaultProfile(user_id, request.user);
				}
				
				const games = await fastify.db.getRecentGames(user_id, limit);
				return games || [];
			} catch (error) {
				fastify.log.error('Error fetching recent games:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	fastify.get('/leaderboard', {
		schema: {
			tags: ['user'],
			summary: 'Get leaderboard',
			security: [{ bearerAuth: [] }],
			querystring: {
				type: 'object',
				properties: {
					limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
				}
			},
			response: {
				200: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							user_id: { type: 'string' },
							username: { type: 'string' },
							avatar_url: { type: 'string' },
							total_score: { type: 'number' },
							games_won: { type: 'number' },
							games_played: { type: 'number' },
							win_rate: { type: 'number' },
							level: { type: 'number' }
						}
					}
				}
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const limit = request.query.limit || 50;
				const leaderboard = await fastify.db.getLeaderboard(limit);
				return leaderboard || [];
			} catch (error) {
				fastify.log.error('Error fetching leaderboard:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	/** Create user profile */
	fastify.post('/profile', {
		schema: {
			tags: ['user'],
			summary: 'Create user profile',
			security: [{ bearerAuth: [] }],
			body: {
				type: 'object',
				properties: {
					user_id: { type: 'string' },
					username: { type: 'string', minLength: 3, maxLength: 50 },
					email: { type: 'string', format: 'email' },
					avatar_url: { type: 'string', format: 'uri' },
					bio: { type: 'string', maxLength: 500 },
					location: { type: 'string', maxLength: 100 }
				},
				required: ['user_id', 'username', 'email']
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const profile = await fastify.db.createUserProfile(request.body);
				return reply.code(201).send(profile);
			} catch (error) {
				if (error.code === 'SQLITE_CONSTRAINT') {
					return reply.code(409).send({ error: 'User profile already exists' });
				}
				fastify.log.error('Error creating user profile:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	fastify.get('/search', {
		schema: {
			tags: ['user'],
			summary: 'Search users by username',
			security: [{ bearerAuth: [] }],
			querystring: {
				type: 'object',
				properties: {
					q: { type: 'string', minLength: 2 },
					limit: { type: 'number', minimum: 1, maximum: 20, default: 10 }
				},
				required: ['q']
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const { q, limit = 10 } = request.query;
				const users = await fastify.db.db.allAsync(`
					SELECT user_id, username, avatar_url, last_seen
					FROM user_profiles 
					WHERE username LIKE ? 
					ORDER BY last_seen DESC
					LIMIT ?
				`, [`%${q}%`, limit]);
				return users || [];
			} catch (error) {
				fastify.log.error('Error searching users:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});

	fastify.get('/dashboard', {
		schema: {
			tags: ['user'],
			summary: 'Get user dashboard data',
			security: [{ bearerAuth: [] }],
			response: {
				200: {
					type: 'object',
					properties: {
						stats: {
							type: 'object',
							properties: {
								gamesPlayed: { type: 'number' },
								wins: { type: 'number' },
								losses: { type: 'number' },
								rating: { type: 'number' }
							}
						},
						recentGames: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									id: { type: 'string' },
									game: { type: 'string' },
									opponent: { type: 'string' },
									result: { type: 'string', enum: ['win', 'loss'] },
									score: { type: 'string' },
									date: { type: 'string' }
								}
							}
						},
						achievements: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									id: { type: 'string' },
									name: { type: 'string' },
									description: { type: 'string' },
									icon: { type: 'string' },
									unlockedAt: { type: 'string' }
								}
							}
						},
						featuredGames: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									id: { type: 'string' },
									name: { type: 'string' },
									description: { type: 'string' },
									icon: { type: 'string' },
									color: { type: 'string' }
								}
							}
						}
					}
				}
			}
		},
		preHandler: fastify.authenticate,
		handler: async (request, reply) => {
			try {
				const user_id = request.user.id || request.user.sub || request.user.user_id;
				fastify.log.info('Dashboard request for user:', { user_id, user: request.user });
				
				if (!user_id) {
					fastify.log.error('No user_id found in JWT token:', request.user);
					return reply.code(400).send({ error: 'Invalid user token' });
				}
				let profile = await fastify.db.getUserProfile(user_id);
				fastify.log.info('Retrieved profile:', profile);
				if (!profile) {
					fastify.log.info(`First-time user detected, creating profile for user_id: ${user_id}`);
					/** Auto-create profile if it doesn't exist */
					const newProfile = {
						user_id: user_id,
						username: request.user.email?.split('@')[0] || `user_${user_id}`,
						email: request.user.email,
						games_played: 0,
						games_won: 0,
						total_score: 0,
						best_score: 0,
						level: 1,
						experience_points: 0,
						win_rate: 0
					};
					
					try {
						profile = await fastify.db.createUserProfile(newProfile);
						fastify.log.info('Auto-created profile:', profile);
					} catch (error) {
						fastify.log.error('Failed to create user profile:', error);
						return reply.code(500).send({ error: 'Failed to create user profile' });
					}
				}
				/** Get user achievements (will be empty for new users) */
				const achievements = await fastify.db.getUserAchievements(user_id);
				/** Get recent games (will be empty for new users) */
				const recentGames = await fastify.db.getRecentGames(user_id, 5);
				const stats = {
					gamesPlayed: profile.games_played || 0,
					wins: profile.games_won || 0,
					losses: (profile.games_played || 0) - (profile.games_won || 0),
					rating: profile.level * 100 + profile.experience_points || 1000
				};
				const transformedRecentGames = recentGames.map(game => ({
					id: game.id.toString(),
					game: game.game_type,
					opponent: 'AI', // You might want to add opponent tracking to your DB
					result: game.completed ? 'win' : 'loss',
					score: game.score.toString(),
					date: new Date(game.created_at).toLocaleDateString()
				}));
				const transformedAchievements = achievements.map(achievement => ({
					id: achievement.id.toString(),
					name: achievement.name,
					description: achievement.description,
					icon: achievement.icon,
					unlockedAt: new Date(achievement.earned_at).toLocaleDateString()
				}));
				
				/** Featured games (static data need to make this dynamic). For the meantime we are not using below */
				const featuredGames = [
					{
						id: 'pong',
						name: 'Pong Classic',
						description: 'The classic arcade game that started it all',
						icon: '🏓',
						color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
					},
					{
						id: 'snake',
						name: 'Snake',
						description: 'Eat, grow, and avoid yourself in this timeless classic',
						icon: '🐍',
						color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
					},
					{
						id: 'tetris',
						name: 'Tetris',
						description: 'Stack blocks and clear lines in this puzzle masterpiece',
						icon: '🧩',
						color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
					}
				];
				
				const dashboardData = {
					stats,
					recentGames: transformedRecentGames,
					achievements: transformedAchievements,
					featuredGames
				};
				
				return dashboardData;
			} catch (error) {
				fastify.log.error('Error fetching dashboard data:', error);
				return reply.code(500).send({ error: 'Internal server error' });
			}
		}
	});
}