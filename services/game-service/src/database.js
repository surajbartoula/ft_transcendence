import sqlite3 from 'sqlite3';
import path, { join } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDatabasePath() {
	const isDocker = process.env.DOCKER_ENV || fs.existsSync('/app');
	if (isDocker) {
		const dataDir = '/app/data';
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}
		return join(dataDir, 'game.db');
	}
	return process.env.DATABASE_PATH || join(__dirname, '../game.db');
}

const dbPath = getDatabasePath();
export const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables
export function initializeDatabase() {
    return new Promise((resolve, reject) => {
        console.log('🎮 Initializing Pong Game Database...');
        
        // Game Sessions table - stores individual game matches
        db.run(`
            CREATE TABLE IF NOT EXISTS game_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player1_id TEXT NOT NULL,
                player2_id TEXT NOT NULL,
                player1_score INTEGER DEFAULT 0,
                player2_score INTEGER DEFAULT 0,
                winner_id TEXT,
                game_mode TEXT NOT NULL CHECK(game_mode IN ('local', 'remote', 'ai', 'tournament')),
                game_duration INTEGER, -- in seconds
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                started_at DATETIME,
                finished_at DATETIME,
                status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting', 'active', 'paused', 'finished', 'cancelled')),
                tournament_id INTEGER,
                match_data JSON, -- Store detailed match statistics
                FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
            )
        `, (err) => {
            if (err) return reject(err);
            
            // Tournaments table
            db.run(`
                CREATE TABLE IF NOT EXISTS tournaments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    creator_id TEXT NOT NULL,
                    max_players INTEGER NOT NULL DEFAULT 8,
                    current_players INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'registration' CHECK(status IN ('registration', 'active', 'finished', 'cancelled')),
                    tournament_type TEXT DEFAULT 'single_elimination' CHECK(tournament_type IN ('single_elimination', 'double_elimination', 'round_robin')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    started_at DATETIME,
                    finished_at DATETIME,
                    winner_id TEXT,
                    current_round INTEGER DEFAULT 1,
                    total_rounds INTEGER,
                    settings JSON -- Tournament specific settings (match duration, etc.)
                )
            `, (err) => {
                if (err) return reject(err);
                
                // Tournament Participants table
                db.run(`
                    CREATE TABLE IF NOT EXISTS tournament_participants (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tournament_id INTEGER NOT NULL,
                        user_id TEXT NOT NULL,
                        username TEXT NOT NULL,
                        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        eliminated_at DATETIME,
                        final_position INTEGER,
                        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'eliminated', 'winner')),
                        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
                        UNIQUE(tournament_id, user_id)
                    )
                `, (err) => {
                    if (err) return reject(err);
                    
                    // Tournament Matches table - for bracket management
                    db.run(`
                        CREATE TABLE IF NOT EXISTS tournament_matches (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            tournament_id INTEGER NOT NULL,
                            round_number INTEGER NOT NULL,
                            match_number INTEGER NOT NULL,
                            player1_id TEXT,
                            player2_id TEXT,
                            winner_id TEXT,
                            game_session_id INTEGER,
                            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'active', 'finished')),
                            scheduled_at DATETIME,
                            FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
                            FOREIGN KEY (game_session_id) REFERENCES game_sessions(id)
                        )
                    `, (err) => {
                        if (err) return reject(err);
                        
                        // Game Invitations table
                        db.run(`
                            CREATE TABLE IF NOT EXISTS game_invitations (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                sender_id TEXT NOT NULL,
                                receiver_id TEXT NOT NULL,
                                game_mode TEXT NOT NULL CHECK(game_mode IN ('remote', 'tournament')),
                                tournament_id INTEGER,
                                message TEXT,
                                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                expires_at DATETIME,
                                responded_at DATETIME,
                                FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
                            )
                        `, (err) => {
                            if (err) return reject(err);
                            
                            // Player Statistics table
                            db.run(`
                                CREATE TABLE IF NOT EXISTS player_statistics (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    user_id TEXT UNIQUE NOT NULL,
                                    total_games INTEGER DEFAULT 0,
                                    wins INTEGER DEFAULT 0,
                                    losses INTEGER DEFAULT 0,
                                    draws INTEGER DEFAULT 0,
                                    total_score INTEGER DEFAULT 0,
                                    highest_score INTEGER DEFAULT 0,
                                    win_streak INTEGER DEFAULT 0,
                                    current_win_streak INTEGER DEFAULT 0,
                                    tournaments_joined INTEGER DEFAULT 0,
                                    tournaments_won INTEGER DEFAULT 0,
                                    average_game_duration REAL DEFAULT 0,
                                    last_played DATETIME,
                                    ranking_points INTEGER DEFAULT 1000,
                                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                                )
                            `, (err) => {
                                if (err) return reject(err);
                                
                                // Game Events table - for detailed match analysis
                                db.run(`
                                    CREATE TABLE IF NOT EXISTS game_events (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        game_session_id INTEGER NOT NULL,
                                        event_type TEXT NOT NULL CHECK(event_type IN ('goal', 'paddle_hit', 'wall_bounce', 'power_up', 'pause', 'resume')),
                                        player_id TEXT,
                                        timestamp_ms INTEGER NOT NULL,
                                        position_x REAL,
                                        position_y REAL,
                                        data JSON, -- Additional event-specific data
                                        FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
                                    )
                                `, (err) => {
                                    if (err) return reject(err);
                                    
                                    // Active Game Rooms table - for managing live games
                                    db.run(`
                                        CREATE TABLE IF NOT EXISTS active_game_rooms (
                                            id TEXT PRIMARY KEY, -- Room ID/Code
                                            game_session_id INTEGER NOT NULL UNIQUE,
                                            player1_socket_id TEXT,
                                            player2_socket_id TEXT,
                                            spectator_count INTEGER DEFAULT 0,
                                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                            last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                                            room_settings JSON,
                                            FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
                                        )
                                    `, (err) => {
                                        if (err) return reject(err);
                                        
                                        // Blocked Users table - prevent game invitations between blocked users
                                        db.run(`
                                            CREATE TABLE IF NOT EXISTS blocked_users (
                                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                blocker_id TEXT NOT NULL,
                                                blocked_id TEXT NOT NULL,
                                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                UNIQUE(blocker_id, blocked_id)
                                            )
                                        `, (err) => {
                                            if (err) return reject(err);
                                            
                                            // Create indexes for better performance
                                            db.run(`
                                                CREATE INDEX IF NOT EXISTS idx_game_sessions_players ON game_sessions(player1_id, player2_id);
                                                CREATE INDEX IF NOT EXISTS idx_game_sessions_tournament ON game_sessions(tournament_id);
                                                CREATE INDEX IF NOT EXISTS idx_game_sessions_created ON game_sessions(created_at);
                                                CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
                                                CREATE INDEX IF NOT EXISTS idx_tournament_participants_user ON tournament_participants(user_id);
                                                CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
                                                CREATE INDEX IF NOT EXISTS idx_game_invitations_receiver ON game_invitations(receiver_id, status);
                                                CREATE INDEX IF NOT EXISTS idx_game_invitations_sender ON game_invitations(sender_id);
                                                CREATE INDEX IF NOT EXISTS idx_player_statistics_user ON player_statistics(user_id);
                                                CREATE INDEX IF NOT EXISTS idx_game_events_session ON game_events(game_session_id);
                                                CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
                                                CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);
                                            `, (err) => {
                                                if (err) return reject(err);
                                                
                                                console.log('✅ Database initialized successfully!');
                                                resolve();
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// Database service class with all game-related operations
export class GameDatabaseService {
    // ========================================
    // GAME SESSIONS
    // ========================================
    
    createGameSession(data) {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT INTO game_sessions (
                    player1_id, player2_id, game_mode, tournament_id, status, match_data
                ) VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                data.player1_id,
                data.player2_id,
                data.game_mode,
                data.tournament_id || null,
                data.status || 'waiting',
                JSON.stringify(data.match_data || {}),
                function(err) {
                    if (err) return reject(err);
                    
                    // Get the created session
                    db.get('SELECT *, match_data as match_data_json FROM game_sessions WHERE id = ?', 
                        [this.lastID], (err, session) => {
                            if (err) return reject(err);
                            
                            if (session && session.match_data_json) {
                                session.match_data = JSON.parse(session.match_data_json);
                                delete session.match_data_json;
                            }
                            resolve(session);
                        });
                }
            );
            stmt.finalize();
        });
    }
    
    getGameSession(sessionId) {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT *, match_data as match_data_json 
                FROM game_sessions 
                WHERE id = ?
            `, [sessionId], (err, session) => {
                if (err) return reject(err);
                
                if (session && session.match_data_json) {
                    session.match_data = JSON.parse(session.match_data_json);
                    delete session.match_data_json;
                }
                resolve(session);
            });
        });
    }
    
    updateGameSession(sessionId, data) {
        return new Promise((resolve, reject) => {
            const allowedFields = [
                'player1_score', 'player2_score', 'winner_id', 'game_duration',
                'started_at', 'finished_at', 'status', 'match_data'
            ];
            
            const updates = [];
            const values = [];
            
            for (const [key, value] of Object.entries(data)) {
                if (allowedFields.includes(key)) {
                    updates.push(`${key} = ?`);
                    values.push(key === 'match_data' ? JSON.stringify(value) : value);
                }
            }
            
            if (updates.length === 0) return resolve(null);
            
            const sql = `
                UPDATE game_sessions 
                SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            values.push(sessionId);
            
            db.run(sql, values, function(err) {
                if (err) return reject(err);
                
                // Return updated session
                db.get('SELECT *, match_data as match_data_json FROM game_sessions WHERE id = ?', 
                    [sessionId], (err, session) => {
                        if (err) return reject(err);
                        
                        if (session && session.match_data_json) {
                            session.match_data = JSON.parse(session.match_data_json);
                            delete session.match_data_json;
                        }
                        resolve(session);
                    });
            });
        });
    }
    
    getPlayerGameHistory(userId, limit = 50, offset = 0) {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    gs.*,
                    CASE 
                        WHEN gs.player1_id = ? THEN 'player1'
                        WHEN gs.player2_id = ? THEN 'player2'
                    END as player_role,
                    CASE 
                        WHEN gs.winner_id = ? THEN 'won'
                        WHEN gs.winner_id IS NULL THEN 'draw'
                        ELSE 'lost'
                    END as result
                FROM game_sessions gs
                WHERE (gs.player1_id = ? OR gs.player2_id = ?)
                AND gs.status = 'finished'
                ORDER BY gs.finished_at DESC
                LIMIT ? OFFSET ?
            `, [userId, userId, userId, userId, userId, limit, offset], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    // ========================================
    // TOURNAMENTS
    // ========================================
    
    createTournament(data) {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT INTO tournaments (
                    name, description, creator_id, max_players, tournament_type, settings
                ) VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                data.name,
                data.description || '',
                data.creator_id,
                data.max_players || 8,
                data.tournament_type || 'single_elimination',
                JSON.stringify(data.settings || {}),
                function(err) {
                    if (err) return reject(err);
                    
                    // Get the created tournament
                    db.get('SELECT *, settings as settings_json FROM tournaments WHERE id = ?', 
                        [this.lastID], (err, tournament) => {
                            if (err) return reject(err);
                            
                            if (tournament && tournament.settings_json) {
                                tournament.settings = JSON.parse(tournament.settings_json);
                                delete tournament.settings_json;
                            }
                            resolve(tournament);
                        });
                }
            );
            stmt.finalize();
        });
    }
    
    getTournament(tournamentId) {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT *, settings as settings_json 
                FROM tournaments 
                WHERE id = ?
            `, [tournamentId], (err, tournament) => {
                if (err) return reject(err);
                
                if (tournament && tournament.settings_json) {
                    tournament.settings = JSON.parse(tournament.settings_json);
                    delete tournament.settings_json;
                }
                resolve(tournament);
            });
        });
    }
    
    async joinTournament(tournamentId, userId, username) {
        try {
            // Check if tournament exists and is accepting registrations
            const tournament = await this.getTournament(tournamentId);
            if (!tournament || tournament.status !== 'registration') {
                throw new Error('Tournament not accepting registrations');
            }
            
            if (tournament.current_players >= tournament.max_players) {
                throw new Error('Tournament is full');
            }
            
            return new Promise((resolve, reject) => {
                const stmt = db.prepare(`
                    INSERT INTO tournament_participants (tournament_id, user_id, username)
                    VALUES (?, ?, ?)
                `);
                
                stmt.run(tournamentId, userId, username, function(err) {
                    if (err) {
                        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                            return reject(new Error('Already joined this tournament'));
                        }
                        return reject(err);
                    }
                    
                    // Update participant count
                    db.run(`
                        UPDATE tournaments 
                        SET current_players = current_players + 1 
                        WHERE id = ?
                    `, [tournamentId], (err) => {
                        if (err) return reject(err);
                        resolve(true);
                    });
                });
                stmt.finalize();
            });
        } catch (error) {
            throw error;
        }
    }
    
    getTournamentParticipants(tournamentId) {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM tournament_participants 
                WHERE tournament_id = ? 
                ORDER BY joined_at ASC
            `, [tournamentId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
    
    async startTournament(tournamentId) {
        try {
            const tournament = await this.getTournament(tournamentId);
            if (!tournament) throw new Error('Tournament not found');
            if (tournament.status !== 'registration') throw new Error('Tournament already started');
            
            const participants = await this.getTournamentParticipants(tournamentId);
            if (participants.length < 2) throw new Error('Need at least 2 players');
            
            // Calculate tournament structure
            const totalRounds = Math.ceil(Math.log2(participants.length));
            
            return new Promise((resolve, reject) => {
                // Update tournament status
                db.run(`
                    UPDATE tournaments 
                    SET status = 'active', started_at = CURRENT_TIMESTAMP, total_rounds = ?
                    WHERE id = ?
                `, [totalRounds, tournamentId], async (err) => {
                    if (err) return reject(err);
                    
                    // Generate first round matches
                    try {
                        await this.generateTournamentMatches(tournamentId, participants);
                        const updatedTournament = await this.getTournament(tournamentId);
                        resolve(updatedTournament);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        } catch (error) {
            throw error;
        }
    }
    
    generateTournamentMatches(tournamentId, participants) {
        return new Promise((resolve, reject) => {
            // Simple single elimination bracket generation
            let round = 1;
            let currentParticipants = [...participants];
            
            // Shuffle participants for random matchups
            for (let i = currentParticipants.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [currentParticipants[i], currentParticipants[j]] = [currentParticipants[j], currentParticipants[i]];
            }
            
            const stmt = db.prepare(`
                INSERT INTO tournament_matches (
                    tournament_id, round_number, match_number, player1_id, player2_id, status
                ) VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            let completedMatches = 0;
            let totalMatches = Math.ceil(currentParticipants.length / 2);
            
            // Generate first round matches
            let matchNumber = 1;
            for (let i = 0; i < currentParticipants.length; i += 2) {
                const player1 = currentParticipants[i];
                const player2 = currentParticipants[i + 1] || null; // Handle odd number of participants
                
                stmt.run(
                    tournamentId,
                    round,
                    matchNumber,
                    player1.user_id,
                    player2?.user_id || null,
                    player2 ? 'ready' : 'finished', // If no opponent, auto-advance
                    (err) => {
                        if (err) return reject(err);
                        
                        completedMatches++;
                        if (completedMatches === totalMatches) {
                            stmt.finalize();
                            resolve();
                        }
                    }
                );
                matchNumber++;
            }
        });
    }
    
    getTournamentMatches(tournamentId, roundNumber = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT tm.*, 
                       tp1.username as player1_username,
                       tp2.username as player2_username,
                       winner.username as winner_username
                FROM tournament_matches tm
                LEFT JOIN tournament_participants tp1 ON tm.player1_id = tp1.user_id AND tm.tournament_id = tp1.tournament_id
                LEFT JOIN tournament_participants tp2 ON tm.player2_id = tp2.user_id AND tm.tournament_id = tp2.tournament_id
                LEFT JOIN tournament_participants winner ON tm.winner_id = winner.user_id AND tm.tournament_id = winner.tournament_id
                WHERE tm.tournament_id = ?
            `;
            
            const params = [tournamentId];
            if (roundNumber) {
                query += ' AND tm.round_number = ?';
                params.push(roundNumber);
            }
            
            query += ' ORDER BY tm.round_number, tm.match_number';
            
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    // ========================================
    // GAME INVITATIONS
    // ========================================
    
    async sendGameInvitation(data) {
        try {
            // Check if users are blocked
            const areBlocked = await this.areUsersBlocked(data.sender_id, data.receiver_id);
            if (areBlocked) {
                throw new Error('Cannot send game invitation to blocked user');
            }
            
            return new Promise((resolve, reject) => {
                const stmt = db.prepare(`
                    INSERT INTO game_invitations (
                        sender_id, receiver_id, game_mode, tournament_id, message, expires_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `);
                
                const expiresAt = new Date();
                expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minute expiry
                
                stmt.run(
                    data.sender_id,
                    data.receiver_id,
                    data.game_mode,
                    data.tournament_id || null,
                    data.message || '',
                    expiresAt.toISOString(),
                    function(err) {
                        if (err) return reject(err);
                        
                        // Get the created invitation
                        db.get('SELECT * FROM game_invitations WHERE id = ?', 
                            [this.lastID], (err, invitation) => {
                                if (err) return reject(err);
                                resolve(invitation);
                            });
                    }
                );
                stmt.finalize();
            });
        } catch (error) {
            throw error;
        }
    }
    
    getGameInvitation(invitationId) {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT * FROM game_invitations WHERE id = ?
            `, [invitationId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }
    
    async respondToGameInvitation(invitationId, response, userId) {
        try {
            const invitation = await this.getGameInvitation(invitationId);
            if (!invitation) throw new Error('Invitation not found');
            if (invitation.receiver_id !== userId) throw new Error('Not authorized');
            if (invitation.status !== 'pending') throw new Error('Invitation already responded to');
            
            // Check if expired
            if (new Date() > new Date(invitation.expires_at)) {
                await this.updateInvitationStatus(invitationId, 'expired');
                throw new Error('Invitation has expired');
            }
            
            return new Promise((resolve, reject) => {
                db.run(`
                    UPDATE game_invitations 
                    SET status = ?, responded_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [response, invitationId], async (err) => {
                    if (err) return reject(err);
                    
                    try {
                        const updatedInvitation = await this.getGameInvitation(invitationId);
                        resolve(updatedInvitation);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        } catch (error) {
            throw error;
        }
    }
    
    getUserGameInvitations(userId, status = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT gi.*, 
                       sender.username as sender_username,
                       receiver.username as receiver_username
                FROM game_invitations gi
                LEFT JOIN user_profiles sender ON gi.sender_id = sender.user_id
                LEFT JOIN user_profiles receiver ON gi.receiver_id = receiver.user_id
                WHERE gi.receiver_id = ?
            `;
            
            const params = [userId];
            if (status) {
                query += ' AND gi.status = ?';
                params.push(status);
            }
            
            query += ' ORDER BY gi.created_at DESC LIMIT 50';
            
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    // Helper method for updating invitation status
    updateInvitationStatus(invitationId, status) {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE game_invitations 
                SET status = ? 
                WHERE id = ?
            `, [status, invitationId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    // ========================================
    // PLAYER STATISTICS
    // ========================================
    
    getOrCreatePlayerStats(userId) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM player_statistics WHERE user_id = ?', [userId], (err, stats) => {
                if (err) return reject(err);
                
                if (!stats) {
                    const stmt = db.prepare(`
                        INSERT INTO player_statistics (user_id) VALUES (?)
                    `);
                    stmt.run(userId, function(err) {
                        if (err) return reject(err);
                        
                        db.get('SELECT * FROM player_statistics WHERE user_id = ?', [userId], (err, newStats) => {
                            if (err) return reject(err);
                            resolve(newStats);
                        });
                    });
                    stmt.finalize();
                } else {
                    resolve(stats);
                }
            });
        });
    }
    
    async updatePlayerStats(userId, gameResult) {
        try {
            const stats = await this.getOrCreatePlayerStats(userId);
            
            const updates = {
                total_games: stats.total_games + 1,
                last_played: new Date().toISOString()
            };
            
            if (gameResult.result === 'won') {
                updates.wins = stats.wins + 1;
                updates.current_win_streak = stats.current_win_streak + 1;
                updates.win_streak = Math.max(stats.win_streak, updates.current_win_streak);
                updates.ranking_points = stats.ranking_points + 25;
            } else if (gameResult.result === 'lost') {
                updates.losses = stats.losses + 1;
                updates.current_win_streak = 0;
                updates.ranking_points = Math.max(800, stats.ranking_points - 15);
            } else {
                updates.draws = stats.draws + 1;
                updates.ranking_points = stats.ranking_points + 5;
            }
            
            if (gameResult.score !== undefined) {
                updates.total_score = stats.total_score + gameResult.score;
                updates.highest_score = Math.max(stats.highest_score, gameResult.score);
            }
            
            if (gameResult.duration !== undefined) {
                const totalDuration = (stats.average_game_duration * stats.total_games) + gameResult.duration;
                updates.average_game_duration = totalDuration / (stats.total_games + 1);
            }
            
            const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
            const updateValues = Object.values(updates);
            
            return new Promise((resolve, reject) => {
                db.run(`
                    UPDATE player_statistics 
                    SET ${updateFields}, updated_at = CURRENT_TIMESTAMP 
                    WHERE user_id = ?
                `, [...updateValues, userId], async (err) => {
                    if (err) return reject(err);
                    
                    try {
                        const updatedStats = await this.getOrCreatePlayerStats(userId);
                        resolve(updatedStats);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        } catch (error) {
            throw error;
        }
    }
    
    getLeaderboard(limit = 100) {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT ps.*, 
                       CASE 
                           WHEN ps.total_games = 0 THEN 0 
                           ELSE ROUND((ps.wins * 100.0 / ps.total_games), 1) 
                       END as win_rate
                FROM player_statistics ps
                WHERE ps.total_games > 0
                ORDER BY ps.ranking_points DESC, ps.wins DESC, ps.win_rate DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    // ========================================
    // GAME ROOMS & LIVE GAMES
    // ========================================
    
    createActiveGameRoom(roomId, gameSessionId, settings = {}) {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT INTO active_game_rooms (id, game_session_id, room_settings)
                VALUES (?, ?, ?)
            `);
            
            stmt.run(roomId, gameSessionId, JSON.stringify(settings), async (err) => {
                if (err) return reject(err);
                
                try {
                    const room = await this.getActiveGameRoom(roomId);
                    resolve(room);
                } catch (error) {
                    reject(error);
                }
            });
            stmt.finalize();
        });
    }
    
    getActiveGameRoom(roomId) {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT *, room_settings as room_settings_json 
                FROM active_game_rooms 
                WHERE id = ?
            `, [roomId], (err, room) => {
                if (err) return reject(err);
                
                if (room && room.room_settings_json) {
                    room.room_settings = JSON.parse(room.room_settings_json);
                    delete room.room_settings_json;
                }
                resolve(room);
            });
        });
    }
    
    updateGameRoom(roomId, data) {
        return new Promise((resolve, reject) => {
            const allowedFields = ['player1_socket_id', 'player2_socket_id', 'spectator_count', 'last_activity'];
            const updates = [];
            const values = [];
            
            for (const [key, value] of Object.entries(data)) {
                if (allowedFields.includes(key)) {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            }
            
            if (updates.length === 0) return resolve(null);
            
            const sql = `
                UPDATE active_game_rooms 
                SET ${updates.join(', ')}
                WHERE id = ?
            `;
            
            values.push(roomId);
            
            db.run(sql, values, async (err) => {
                if (err) return reject(err);
                
                try {
                    const updatedRoom = await this.getActiveGameRoom(roomId);
                    resolve(updatedRoom);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
    
    removeActiveGameRoom(roomId) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM active_game_rooms WHERE id = ?', [roomId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    // ========================================
    // BLOCKING SYSTEM
    // ========================================
    
    blockUser(blockerId, blockedId) {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO blocked_users (blocker_id, blocked_id)
                VALUES (?, ?)
            `);
            stmt.run(blockerId, blockedId, (err) => {
                if (err) return reject(err);
                resolve();
            });
            stmt.finalize();
        });
    }
    
    unblockUser(blockerId, blockedId) {
        return new Promise((resolve, reject) => {
            db.run(`
                DELETE FROM blocked_users 
                WHERE blocker_id = ? AND blocked_id = ?
            `, [blockerId, blockedId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }
    
    areUsersBlocked(user1Id, user2Id) {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT 1 FROM blocked_users 
                WHERE (blocker_id = ? AND blocked_id = ?) 
                   OR (blocker_id = ? AND blocked_id = ?)
                LIMIT 1
            `, [user1Id, user2Id, user2Id, user1Id], (err, row) => {
                if (err) return reject(err);
                resolve(!!row);
            });
        });
    }
    
    getBlockedUsers(userId) {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT blocked_id as user_id FROM blocked_users 
                WHERE blocker_id = ?
                ORDER BY created_at DESC
            `, [userId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    // ========================================
    // GAME EVENTS & ANALYTICS
    // ========================================
    
    recordGameEvent(gameSessionId, eventData) {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT INTO game_events (
                    game_session_id, event_type, player_id, timestamp_ms, 
                    position_x, position_y, data
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                gameSessionId,
                eventData.event_type,
                eventData.player_id || null,
                eventData.timestamp_ms,
                eventData.position_x || null,
                eventData.position_y || null,
                JSON.stringify(eventData.data || {}),
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
            stmt.finalize();
        });
    }
    
    getGameEvents(gameSessionId) {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT *, data as data_json 
                FROM game_events 
                WHERE game_session_id = ? 
                ORDER BY timestamp_ms ASC
            `, [gameSessionId], (err, events) => {
                if (err) return reject(err);
                
                const processedEvents = events.map(event => {
                    if (event.data_json) {
                        event.data = JSON.parse(event.data_json);
                        delete event.data_json;
                    }
                    return event;
                });
                
                resolve(processedEvents);
            });
        });
    }

    // ========================================
    // UTILITY METHODS
    // ========================================
    
    cleanupExpiredInvitations() {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE game_invitations 
                SET status = 'expired' 
                WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP
            `, function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    }
    
    cleanupOldGameRooms(hoursOld = 24) {
        return new Promise((resolve, reject) => {
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - hoursOld);
            
            db.run(`
                DELETE FROM active_game_rooms 
                WHERE last_activity < ?
            `, [cutoffTime.toISOString()], function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    }
}