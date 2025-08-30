import sqlite3 from 'sqlite3';
import path, { join } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
                    seeding_method TEXT DEFAULT 'random' CHECK(seeding_method IN ('random', 'ranking', 'manual')),
                    auto_advance_timer INTEGER DEFAULT 300, -- seconds to wait for no-show
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
                
                // Tournament Participants table - now with seeding support
                db.run(`
                    CREATE TABLE IF NOT EXISTS tournament_participants (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tournament_id INTEGER NOT NULL,
                        user_id TEXT NOT NULL,
                        username TEXT NOT NULL,
                        seed_number INTEGER, -- 1 is highest seed
                        ranking_points INTEGER DEFAULT 1000, -- Used for automatic seeding
                        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        eliminated_at DATETIME,
                        final_position INTEGER,
                        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'eliminated', 'winner')),
                        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
                        UNIQUE(tournament_id, user_id),
                        UNIQUE(tournament_id, seed_number)
                    )
                `, (err) => {
                    if (err) return reject(err);
                    
                    // Tournament Matches table
                    db.run(`
                        CREATE TABLE IF NOT EXISTS tournament_matches (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            tournament_id INTEGER NOT NULL,
                            round_number INTEGER NOT NULL,
                            match_number INTEGER NOT NULL,
                            bracket_position TEXT, -- e.g., "WB-R1-M1" (Winners Bracket - Round 1 - Match 1)
                            player1_id TEXT,
                            player2_id TEXT,
                            player1_seed INTEGER,
                            player2_seed INTEGER,
                            winner_id TEXT,
                            game_session_id INTEGER,
                            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'active', 'finished', 'walkover')),
                            scheduled_at DATETIME,
                            deadline_at DATETIME, -- Auto-advance if no show
                            next_match_winner INTEGER, -- ID of match where winner advances
                            next_match_loser INTEGER, -- ID of match where loser goes (double elimination)
                            FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
                            FOREIGN KEY (game_session_id) REFERENCES game_sessions(id),
                            FOREIGN KEY (next_match_winner) REFERENCES tournament_matches(id),
                            FOREIGN KEY (next_match_loser) REFERENCES tournament_matches(id)
                        )
                    `, (err) => {
                        if (err) return reject(err);
                        
                        // Tournament Announcements table - new addition
                        db.run(`
                            CREATE TABLE IF NOT EXISTS tournament_announcements (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                tournament_id INTEGER NOT NULL,
                                announcement_type TEXT NOT NULL CHECK(announcement_type IN ('general', 'match_ready', 'match_result', 'round_complete', 'player_advance', 'elimination', 'tournament_start', 'tournament_end')),
                                title TEXT NOT NULL,
                                message TEXT NOT NULL,
                                target_users TEXT, -- JSON array of user IDs, null for all participants
                                match_id INTEGER, -- Reference to specific match if applicable
                                priority INTEGER DEFAULT 1 CHECK(priority IN (1, 2, 3)), -- 1=low, 2=medium, 3=high
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                expires_at DATETIME,
                                is_read_by TEXT DEFAULT '[]', -- JSON array of user IDs who have read this
                                created_by TEXT, -- User ID who created the announcement
                                FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
                                FOREIGN KEY (match_id) REFERENCES tournament_matches(id)
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
                                    
                                    // Game Events table
                                    db.run(`
                                        CREATE TABLE IF NOT EXISTS game_events (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            game_session_id INTEGER NOT NULL,
                                            event_type TEXT NOT NULL CHECK(event_type IN ('goal', 'paddle_hit', 'wall_bounce', 'power_up', 'pause', 'resume')),
                                            player_id TEXT,
                                            timestamp_ms INTEGER NOT NULL,
                                            position_x REAL,
                                            position_y REAL,
                                            data JSON,
                                            FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
                                        )
                                    `, (err) => {
                                        if (err) return reject(err);
                                        
                                        // Active Game Rooms table
                                        db.run(`
                                            CREATE TABLE IF NOT EXISTS active_game_rooms (
                                                id TEXT PRIMARY KEY,
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
                                            
                                            // Blocked Users table
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
                                                    CREATE INDEX IF NOT EXISTS idx_tournament_participants_seed ON tournament_participants(tournament_id, seed_number);
                                                    CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
                                                    CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket ON tournament_matches(tournament_id, bracket_position);
                                                    CREATE INDEX IF NOT EXISTS idx_tournament_announcements_tournament ON tournament_announcements(tournament_id, created_at);
                                                    CREATE INDEX IF NOT EXISTS idx_tournament_announcements_type ON tournament_announcements(tournament_id, announcement_type);
                                                    CREATE INDEX IF NOT EXISTS idx_game_invitations_receiver ON game_invitations(receiver_id, status);
                                                    CREATE INDEX IF NOT EXISTS idx_game_invitations_sender ON game_invitations(sender_id);
                                                    CREATE INDEX IF NOT EXISTS idx_player_statistics_user ON player_statistics(user_id);
                                                    CREATE INDEX IF NOT EXISTS idx_player_statistics_ranking ON player_statistics(ranking_points DESC);
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
    });
}

// Database service class with tournament features
export class GameDatabaseService {
    // ========================================
    // GAME SESSIONS (existing methods unchanged)
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
                SET ${updates.join(', ')}
                WHERE id = ?
            `;
            
            values.push(sessionId);
            
            db.run(sql, values, function(err) {
                if (err) return reject(err);
                
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
    // TOURNAMENTS WITH SEEDING
    // ========================================
    
    createTournament(data) {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT INTO tournaments (
                    name, description, creator_id, max_players, tournament_type, 
                    seeding_method, auto_advance_timer, settings
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                data.name,
                data.description || '',
                data.creator_id,
                data.max_players || 8,
                data.tournament_type || 'single_elimination',
                data.seeding_method || 'random',
                data.auto_advance_timer || 300,
                JSON.stringify(data.settings || {}),
                function(err) {
                    if (err) return reject(err);
                    
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
            const tournament = await this.getTournament(tournamentId);
            if (!tournament || tournament.status !== 'registration') {
                throw new Error('Tournament not accepting registrations');
            }
            
            if (tournament.current_players >= tournament.max_players) {
                throw new Error('Tournament is full');
            }

            // Get player's current ranking points for seeding
            const playerStats = await this.getOrCreatePlayerStats(userId);
            
            return new Promise((resolve, reject) => {
                const stmt = db.prepare(`
                    INSERT INTO tournament_participants (tournament_id, user_id, username, ranking_points)
                    VALUES (?, ?, ?, ?)
                `);
                
                stmt.run(tournamentId, userId, username, playerStats.ranking_points, function(err) {
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
                ORDER BY seed_number ASC, ranking_points DESC, joined_at ASC
            `, [tournamentId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
    
    // Method to apply seeding to tournament participants
    async applySeeding(tournamentId, seedingMethod = 'ranking') {
        try {
            const participants = await this.getTournamentParticipants(tournamentId);
            
            let seedOrder;
            if (seedingMethod === 'ranking') {
                // Sort by ranking points (highest first)
                seedOrder = participants.sort((a, b) => b.ranking_points - a.ranking_points);
            } else if (seedingMethod === 'random') {
                // Random shuffle
                seedOrder = [...participants];
                for (let i = seedOrder.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [seedOrder[i], seedOrder[j]] = [seedOrder[j], seedOrder[i]];
                }
            } else {
                // Manual seeding - keep current order
                seedOrder = participants;
            }
            
            // Apply seed numbers
            const promises = seedOrder.map((participant, index) => {
                return new Promise((resolve, reject) => {
                    db.run(`
                        UPDATE tournament_participants 
                        SET seed_number = ? 
                        WHERE tournament_id = ? AND user_id = ?
                    `, [index + 1, tournamentId, participant.user_id], (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            });
            
            await Promise.all(promises);
            return await this.getTournamentParticipants(tournamentId);
        } catch (error) {
            throw error;
        }
    }
    
    // tournament start with proper seeding and bracket generation
    async startTournament(tournamentId) {
        try {
            const tournament = await this.getTournament(tournamentId);
            if (!tournament) throw new Error('Tournament not found');
            if (tournament.status !== 'registration') throw new Error('Tournament already started');
            
            let participants = await this.getTournamentParticipants(tournamentId);
            if (participants.length < 2) throw new Error('Need at least 2 players');
            
            // Apply seeding if not already done
            if (!participants[0].seed_number) {
                participants = await this.applySeeding(tournamentId, tournament.seeding_method);
            }
            
            // Calculate tournament structure
            const totalRounds = Math.ceil(Math.log2(participants.length));
            
            return new Promise((resolve, reject) => {
                db.run(`
                    UPDATE tournaments 
                    SET status = 'active', started_at = CURRENT_TIMESTAMP, total_rounds = ?
                    WHERE id = ?
                `, [totalRounds, tournamentId], async (err) => {
                    if (err) return reject(err);
                    
                    try {
                        await this.generateSeededTournamentMatches(tournamentId, participants);
                        
                        // Create tournament start announcement
                        await this.createAnnouncement(tournamentId, {
                            type: 'tournament_start',
                            title: 'Tournament Started!',
                            message: `The tournament "${tournament.name}" has begun! Check your first round matches.`,
                            priority: 3,
                            created_by: tournament.creator_id
                        });
                        
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
    
    // Match generation with proper bracket positioning
    generateSeededTournamentMatches(tournamentId, participants) {
        return new Promise((resolve, reject) => {
            const round = 1;
            const tournamentType = 'single_elimination'; // TODO: Get from tournament settings
            
            // Standard single elimination bracket pairings (1 vs 8, 2 vs 7, etc.)
            const bracketPairs = this.generateBracketPairings(participants);
            
            const stmt = db.prepare(`
                INSERT INTO tournament_matches (
                    tournament_id, round_number, match_number, bracket_position,
                    player1_id, player2_id, player1_seed, player2_seed, 
                    status, deadline_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            let completedMatches = 0;
            const totalMatches = bracketPairs.length;
            const deadlineTime = new Date();
            deadlineTime.setMinutes(deadlineTime.getMinutes() + 15); // 15 min to start match
            
            bracketPairs.forEach((pair, index) => {
                const matchNumber = index + 1;
                const bracketPosition = `R${round}-M${matchNumber}`;
                const player1 = pair.player1;
                const player2 = pair.player2;
                
                stmt.run(
                    tournamentId,
                    round,
                    matchNumber,
                    bracketPosition,
                    player1?.user_id || null,
                    player2?.user_id || null,
                    player1?.seed_number || null,
                    player2?.seed_number || null,
                    player2 ? 'ready' : 'walkover', // If no opponent, it's a walkover
                    deadlineTime.toISOString(),
                    (err) => {
                        if (err) return reject(err);
                        
                        completedMatches++;
                        if (completedMatches === totalMatches) {
                            stmt.finalize();
                            resolve();
                        }
                    }
                );
            });
            
            if (totalMatches === 0) {
                stmt.finalize();
                resolve();
            }
        });
    }
    
    // Helper method to generate proper bracket pairings
    generateBracketPairings(participants) {
        const pairs = [];
        const sortedParticipants = [...participants].sort((a, b) => a.seed_number - b.seed_number);
        
        // Standard single elimination bracket (1vs8, 2vs7, 3vs6, 4vs5, etc.)
        for (let i = 0; i < sortedParticipants.length; i += 2) {
            const player1 = sortedParticipants[i];
            const player2 = sortedParticipants[i + 1] || null;
            pairs.push({ player1, player2 });
        }
        
        return pairs;
    }
    
    // Method to get matches with bracket info
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
    
    // Method to advance players after match completion
    async advanceWinnerToNextRound(matchId, winnerId) {
        try {
            const match = await this.getTournamentMatch(matchId);
            if (!match || match.status !== 'finished') {
                throw new Error('Match not finished');
            }
            
            // Update match with winner
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE tournament_matches 
                    SET winner_id = ? 
                    WHERE id = ?
                `, [winnerId, matchId], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            
            // Create advancement announcement
            const winnerParticipant = await this.getTournamentParticipant(match.tournament_id, winnerId);
            if (winnerParticipant) {
                await this.createAnnouncement(match.tournament_id, {
                    type: 'player_advance',
                    title: 'Player Advanced!',
                    message: `${winnerParticipant.username} has advanced to the next round!`,
                    target_users: JSON.stringify([winnerId]),
                    match_id: matchId,
                    priority: 2
                });
            }
            
            // Check if we need to generate next round matches
            await this.checkAndGenerateNextRound(match.tournament_id);
            
        } catch (error) {
            throw error;
        }
    }
    
    // Method to get a specific tournament match
    getTournamentMatch(matchId) {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT tm.*, 
                       tp1.username as player1_username,
                       tp2.username as player2_username
                FROM tournament_matches tm
                LEFT JOIN tournament_participants tp1 ON tm.player1_id = tp1.user_id AND tm.tournament_id = tp1.tournament_id
                LEFT JOIN tournament_participants tp2 ON tm.player2_id = tp2.user_id AND tm.tournament_id = tp2.tournament_id
                WHERE tm.id = ?
            `, [matchId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }
    
    // Method to get a tournament participant
    getTournamentParticipant(tournamentId, userId) {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT * FROM tournament_participants 
                WHERE tournament_id = ? AND user_id = ?
            `, [tournamentId, userId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }
    
    // Method to check and generate next round matches
    async checkAndGenerateNextRound(tournamentId) {
        try {
            const tournament = await this.getTournament(tournamentId);
            if (!tournament || tournament.status !== 'active') return;
            
            const currentRoundMatches = await this.getTournamentMatches(tournamentId, tournament.current_round);
            const finishedMatches = currentRoundMatches.filter(m => m.status === 'finished' || m.status === 'walkover');
            
            // If all matches in current round are finished, generate next round
            if (finishedMatches.length === currentRoundMatches.length && currentRoundMatches.length > 0) {
                const winners = finishedMatches.map(m => m.winner_id).filter(Boolean);
                
                if (winners.length === 1) {
                    // Tournament is complete
                    await this.completeTournament(tournamentId, winners[0]);
                } else if (winners.length > 1) {
                    // Generate next round
                    await this.generateNextRoundMatches(tournamentId, winners);
                }
            }
        } catch (error) {
            console.error('Error checking next round:', error);
        }
    }
    
    // Method to generate next round matches
    async generateNextRoundMatches(tournamentId, winnerIds) {
        try {
            const tournament = await this.getTournament(tournamentId);
            const nextRound = tournament.current_round + 1;
            
            // Get winner participants with their seed info
            const winners = [];
            for (const winnerId of winnerIds) {
                const participant = await this.getTournamentParticipant(tournamentId, winnerId);
                if (participant) winners.push(participant);
            }
            
            // Sort by seed for proper bracket progression
            winners.sort((a, b) => a.seed_number - b.seed_number);
            
            const matches = [];
            for (let i = 0; i < winners.length; i += 2) {
                const player1 = winners[i];
                const player2 = winners[i + 1] || null;
                
                if (player1) {
                    matches.push({
                        round_number: nextRound,
                        match_number: Math.floor(i / 2) + 1,
                        bracket_position: `R${nextRound}-M${Math.floor(i / 2) + 1}`,
                        player1_id: player1.user_id,
                        player2_id: player2?.user_id || null,
                        player1_seed: player1.seed_number,
                        player2_seed: player2?.seed_number || null,
                        status: player2 ? 'ready' : 'walkover'
                    });
                }
            }
            
            // Insert new matches
            for (const match of matches) {
                await new Promise((resolve, reject) => {
                    const stmt = db.prepare(`
                        INSERT INTO tournament_matches (
                            tournament_id, round_number, match_number, bracket_position,
                            player1_id, player2_id, player1_seed, player2_seed, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);
                    
                    stmt.run(
                        tournamentId,
                        match.round_number,
                        match.match_number,
                        match.bracket_position,
                        match.player1_id,
                        match.player2_id,
                        match.player1_seed,
                        match.player2_seed,
                        match.status,
                        (err) => {
                            if (err) return reject(err);
                            stmt.finalize();
                            resolve();
                        }
                    );
                });
            }
            
            // Update tournament current round
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE tournaments 
                    SET current_round = ? 
                    WHERE id = ?
                `, [nextRound, tournamentId], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            
            // Create round completion announcement
            await this.createAnnouncement(tournamentId, {
                type: 'round_complete',
                title: `Round ${tournament.current_round} Complete!`,
                message: `Round ${tournament.current_round} has finished. Round ${nextRound} matches are now available.`,
                priority: 2
            });
            
        } catch (error) {
            throw error;
        }
    }
    
    // Method to complete tournament
    async completeTournament(tournamentId, winnerId) {
        try {
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE tournaments 
                    SET status = 'finished', finished_at = CURRENT_TIMESTAMP, winner_id = ?
                    WHERE id = ?
                `, [winnerId, tournamentId], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            
            // Update winner's stats
            await this.updatePlayerStats(winnerId, {
                result: 'tournament_won',
                tournaments_won: 1
            });
            
            const winner = await this.getTournamentParticipant(tournamentId, winnerId);
            const tournament = await this.getTournament(tournamentId);
            
            // Create tournament end announcement
            await this.createAnnouncement(tournamentId, {
                type: 'tournament_end',
                title: 'Tournament Complete!',
                message: `🏆 ${winner.username} has won "${tournament.name}"! Congratulations!`,
                priority: 3
            });
            
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // TOURNAMENT ANNOUNCEMENTS SYSTEM
    // ========================================
    
    createAnnouncement(tournamentId, data) {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT INTO tournament_announcements (
                    tournament_id, announcement_type, title, message, 
                    target_users, match_id, priority, created_by, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const expiresAt = data.expires_at || (() => {
                const exp = new Date();
                exp.setHours(exp.getHours() + 24); // Default 24 hour expiry
                return exp.toISOString();
            })();
            
            stmt.run(
                tournamentId,
                data.type,
                data.title,
                data.message,
                data.target_users || null,
                data.match_id || null,
                data.priority || 1,
                data.created_by || null,
                expiresAt,
                function(err) {
                    if (err) return reject(err);
                    
                    db.get('SELECT * FROM tournament_announcements WHERE id = ?', 
                        [this.lastID], (err, announcement) => {
                            if (err) return reject(err);
                            resolve(announcement);
                        });
                }
            );
            stmt.finalize();
        });
    }
    
    getTournamentAnnouncements(tournamentId, userId = null, unreadOnly = false) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT * FROM tournament_announcements 
                WHERE tournament_id = ? 
                AND expires_at > CURRENT_TIMESTAMP
            `;
            const params = [tournamentId];
            
            if (userId) {
                query += ` AND (target_users IS NULL OR target_users LIKE '%"${userId}"%')`;
                
                if (unreadOnly) {
                    query += ` AND (is_read_by NOT LIKE '%"${userId}"%' OR is_read_by = '[]')`;
                }
            }
            
            query += ' ORDER BY priority DESC, created_at DESC';
            
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                
                const announcements = rows.map(row => ({
                    ...row,
                    target_users: row.target_users ? JSON.parse(row.target_users) : null,
                    is_read_by: row.is_read_by ? JSON.parse(row.is_read_by) : []
                }));
                
                resolve(announcements);
            });
        });
    }
    
    markAnnouncementAsRead(announcementId, userId) {
        return new Promise((resolve, reject) => {
            // First get current read list
            db.get('SELECT is_read_by FROM tournament_announcements WHERE id = ?', 
                [announcementId], (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error('Announcement not found'));
                    
                    const readBy = row.is_read_by ? JSON.parse(row.is_read_by) : [];
                    if (!readBy.includes(userId)) {
                        readBy.push(userId);
                    }
                    
                    db.run(`
                        UPDATE tournament_announcements 
                        SET is_read_by = ? 
                        WHERE id = ?
                    `, [JSON.stringify(readBy), announcementId], (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
        });
    }
    
    // Method to create match-ready announcements
    async createMatchReadyAnnouncement(tournamentId, matchId, playerIds) {
        try {
            const match = await this.getTournamentMatch(matchId);
            if (!match) return;
            
            await this.createAnnouncement(tournamentId, {
                type: 'match_ready',
                title: 'Your Match is Ready!',
                message: `Your match is ready to begin: ${match.player1_username} vs ${match.player2_username}. Join now!`,
                target_users: JSON.stringify(playerIds),
                match_id: matchId,
                priority: 3
            });
        } catch (error) {
            console.error('Error creating match ready announcement:', error);
        }
    }

    // ========================================
    // GAME INVITATIONS (existing methods unchanged)
    // ========================================
    
    async sendGameInvitation(data) {
        try {
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
                expiresAt.setMinutes(expiresAt.getMinutes() + 5);
                
                stmt.run(
                    data.sender_id,
                    data.receiver_id,
                    data.game_mode,
                    data.tournament_id || null,
                    data.message || '',
                    expiresAt.toISOString(),
                    function(err) {
                        if (err) return reject(err);
                        
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
            console.log(`🔍 Authorization check - Invitation receiver: "${invitation?.receiver_id}" (${typeof invitation?.receiver_id}), User: "${userId}" (${typeof userId}), String(User): "${String(userId)}"`);
            if (!invitation) throw new Error('Invitation not found');
            if (invitation.receiver_id !== String(userId)) throw new Error('Not authorized');
            if (invitation.status !== 'pending') throw new Error('Invitation already responded to');
            
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
                SELECT gi.*
                FROM game_invitations gi
                WHERE gi.receiver_id = ? OR gi.sender_id = ?
            `;
            
            const params = [userId, userId];
            if (status) {
                query += ' AND gi.status = ?';
                params.push(status);
            }
            
            query += ' ORDER BY gi.created_at DESC LIMIT 50';
            
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

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
    // PLAYER STATISTICS (existing methods unchanged)
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
            } else if (gameResult.result === 'tournament_won') {
                updates.tournaments_won = stats.tournaments_won + (gameResult.tournaments_won || 1);
                updates.ranking_points = stats.ranking_points + 100;
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
                ORDER BY ps.ranking_points DESC, ps.wins DESC, win_rate DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    // ========================================
    // GAME ROOMS & LIVE GAMES (existing methods unchanged)
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
    // BLOCKING SYSTEM (existing methods unchanged)
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
    // GAME EVENTS & ANALYTICS (existing methods unchanged)
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
    
    cleanupExpiredAnnouncements() {
        return new Promise((resolve, reject) => {
            db.run(`
                DELETE FROM tournament_announcements 
                WHERE expires_at < CURRENT_TIMESTAMP
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