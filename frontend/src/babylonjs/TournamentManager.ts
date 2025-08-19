// =====================================
// TOURNAMENT MANAGEMENT SYSTEM
// =====================================

export interface TournamentPlayer {
    id: string;
    name: string;
    isEliminated: boolean;
}

export interface TournamentMatch {
    id: string;
    roundNumber: number;
    matchNumber: number;
    player1: TournamentPlayer;
    player2: TournamentPlayer;
    winner?: TournamentPlayer;
    isComplete: boolean;
    score?: { player1: number, player2: number };
}

export interface Tournament {
    id: string;
    name: string;
    players: TournamentPlayer[];
    matches: TournamentMatch[];
    currentRound: number;
    totalRounds: number;
    isComplete: boolean;
    winner: TournamentPlayer | null;
    createdAt: Date;
}

export class TournamentManager {
    private tournaments: Map<string, Tournament> = new Map();
    private currentTournamentId: string | null = null;

    createTournament(playerNames: string[]): Tournament {
        console.log('🏗️ TournamentManager: Creating tournament...');
        console.log(`   Input players (${playerNames.length}): [${playerNames.join(', ')}]`);
        
        // Validate minimum players
        if (playerNames.length < 2) {
            console.error('   ❌ Cannot create tournament: need at least 2 players');
            throw new Error('Tournament requires at least 2 players');
        }

        // Ensure we have a power of 2 for clean bracket
        const validPlayerCounts = [2, 4, 8, 16];
        let actualPlayerCount = playerNames.length;
        
        console.log(`   Valid bracket sizes: [${validPlayerCounts.join(', ')}]`);
        console.log(`   Current player count: ${actualPlayerCount}`);
        
        // Find next valid player count or pad with "Bye" players
        if (!validPlayerCounts.includes(actualPlayerCount)) {
            actualPlayerCount = validPlayerCounts.find(count => count > playerNames.length) || 8;
            console.log(`   🔧 Adjusting to valid bracket size: ${actualPlayerCount}`);
        }

        // Create players
        const players: TournamentPlayer[] = playerNames.map((name, index) => ({
            id: `player_${index}`,
            name: name.trim(),
            isEliminated: false
        }));

        console.log(`   Created ${players.length} player objects`);

        // Add bye players if needed
        let byeCount = 0;
        while (players.length < actualPlayerCount) {
            players.push({
                id: `bye_${players.length}`,
                name: 'Bye',
                isEliminated: false
            });
            byeCount++;
        }
        
        if (byeCount > 0) {
            console.log(`   🤖 Added ${byeCount} "Bye" players for balanced bracket`);
        }
        
        console.log(`   Final player list (${players.length}): [${players.map(p => p.name).join(', ')}]`);

        // Calculate tournament structure
        const totalRounds = Math.log2(actualPlayerCount);
        const tournamentId = `tournament_${Date.now()}`;

        console.log(`   📊 Tournament structure:`);
        console.log(`     Total rounds: ${totalRounds}`);
        console.log(`     Tournament ID: ${tournamentId}`);

        const tournament: Tournament = {
            id: tournamentId,
            name: `Tournament ${new Date().toLocaleDateString()}`,
            players,
            matches: [],
            currentRound: 1,
            totalRounds,
            isComplete: false,
            winner: null,
            createdAt: new Date()
        };

        console.log(`   🎯 Generating first round matches...`);
        // Generate first round matches
        this.generateRoundMatches(tournament, 1);
        
        console.log(`   💾 Storing tournament (ID: ${tournamentId})`);
        this.tournaments.set(tournamentId, tournament);
        this.currentTournamentId = tournamentId;
        
        console.log(`✅ Tournament created successfully:`);
        console.log(`   Players: ${players.length}, Rounds: ${totalRounds}, Matches: ${tournament.matches.length}`);
        return tournament;
    }

    private generateRoundMatches(tournament: Tournament, roundNumber: number): void {
        console.log(`🎮 TournamentManager: Generating round ${roundNumber} matches...`);
        
        if (roundNumber === 1) {
            // First round - pair up all players
            const activePlayers = tournament.players.filter(p => !p.isEliminated);
            console.log(`   Active players for round 1 (${activePlayers.length}): [${activePlayers.map(p => p.name).join(', ')}]`);
            
            let matchCount = 0;
            let byeMatchCount = 0;
            
            for (let i = 0; i < activePlayers.length; i += 2) {
                const player1 = activePlayers[i];
                const player2 = activePlayers[i + 1];
                
                const matchId = `match_${roundNumber}_${Math.floor(i / 2)}`;
                const matchNumber = Math.floor(i / 2) + 1;
                
                console.log(`   Creating match ${matchNumber}: ${player1.name} vs ${player2?.name || 'undefined'}`);
                
                const match: TournamentMatch = {
                    id: matchId,
                    roundNumber,
                    matchNumber,
                    player1,
                    player2,
                    isComplete: false
                };

                // Handle bye matches automatically
                if (player2.name === 'Bye') {
                    match.winner = player1;
                    match.isComplete = true;
                    match.score = { player1: 11, player2: 0 };
                    byeMatchCount++;
                    console.log(`     ✅ Auto-completed bye match: ${player1.name} advances`);
                } else {
                    console.log(`     ⚔️ Regular match created: ${player1.name} vs ${player2.name}`);
                }

                tournament.matches.push(match);
                matchCount++;
            }
            
            console.log(`   Round 1 complete: ${matchCount} matches created (${byeMatchCount} bye matches)`);
        } else {
            // Subsequent rounds - pair up winners from previous round
            const previousRoundMatches = tournament.matches.filter(
                m => m.roundNumber === roundNumber - 1 && m.isComplete && m.winner
            );

            if (previousRoundMatches.length < 2) {
                // Tournament is complete
                tournament.isComplete = true;
                if (previousRoundMatches.length === 1 && previousRoundMatches[0].winner) {
                    tournament.winner = previousRoundMatches[0].winner;
                }
                return;
            }

            for (let i = 0; i < previousRoundMatches.length; i += 2) {
                const match1 = previousRoundMatches[i];
                const match2 = previousRoundMatches[i + 1];
                
                if (match1.winner && match2?.winner) {
                    const match: TournamentMatch = {
                        id: `match_${roundNumber}_${Math.floor(i / 2)}`,
                        roundNumber,
                        matchNumber: Math.floor(i / 2) + 1,
                        player1: match1.winner,
                        player2: match2.winner,
                        isComplete: false
                    };

                    tournament.matches.push(match);
                }
            }
        }
    }

    completeMatch(tournamentId: string, matchId: string, winnerName: string, score?: { player1: number, player2: number }): void {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        const match = tournament.matches.find(m => m.id === matchId);
        if (!match) {
            throw new Error('Match not found');
        }

        if (match.isComplete) {
            throw new Error('Match already completed');
        }

        // Determine winner
        const winner = match.player1.name === winnerName ? match.player1 : match.player2;
        const loser = match.player1.name === winnerName ? match.player2 : match.player1;

        match.winner = winner;
        match.isComplete = true;
        match.score = score;

        // Eliminate loser
        loser.isEliminated = true;

        console.log(`🏆 Match completed: ${winner.name} defeats ${loser.name}`);

        // Check if round is complete
        const currentRoundMatches = tournament.matches.filter(m => m.roundNumber === tournament.currentRound);
        const completedMatches = currentRoundMatches.filter(m => m.isComplete);

        if (completedMatches.length === currentRoundMatches.length) {
            // Round complete - generate next round
            tournament.currentRound++;
            
            if (tournament.currentRound <= tournament.totalRounds) {
                this.generateRoundMatches(tournament, tournament.currentRound);
            } else {
                tournament.isComplete = true;
                tournament.winner = winner;
                console.log(`🏆 Tournament complete! Winner: ${winner.name}`);
            }
        }
    }

    getNextMatch(tournamentId: string): TournamentMatch | null {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return null;

        // Find first incomplete match in current round
        return tournament.matches.find(
            m => m.roundNumber === tournament.currentRound && !m.isComplete
        ) || null;
    }

    getCurrentMatch(tournamentId: string): TournamentMatch | null {
        return this.getNextMatch(tournamentId);
    }

    getTournament(tournamentId: string): Tournament | null {
        return this.tournaments.get(tournamentId) || null;
    }

    getTournamentBracket(tournamentId: string): { rounds: TournamentMatch[][] } {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        const rounds: TournamentMatch[][] = [];
        
        for (let round = 1; round <= tournament.totalRounds; round++) {
            const roundMatches = tournament.matches.filter(m => m.roundNumber === round);
            rounds.push(roundMatches);
        }

        return { rounds };
    }

    getRemainingPlayers(tournamentId: string): TournamentPlayer[] {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return [];

        return tournament.players.filter(p => !p.isEliminated && p.name !== 'Bye');
    }

    getTournamentStats(tournamentId: string): {
        totalPlayers: number;
        remainingPlayers: number;
        completedMatches: number;
        totalMatches: number;
        currentRound: number;
        totalRounds: number;
    } {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        const remainingPlayers = this.getRemainingPlayers(tournamentId);
        const completedMatches = tournament.matches.filter(m => m.isComplete).length;

        return {
            totalPlayers: tournament.players.filter(p => p.name !== 'Bye').length,
            remainingPlayers: remainingPlayers.length,
            completedMatches,
            totalMatches: tournament.matches.length,
            currentRound: tournament.currentRound,
            totalRounds: tournament.totalRounds
        };
    }

    // Get upcoming matches for display
    getUpcomingMatches(tournamentId: string, limit: number = 3): TournamentMatch[] {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return [];

        return tournament.matches
            .filter(m => !m.isComplete)
            .sort((a, b) => {
                if (a.roundNumber !== b.roundNumber) {
                    return a.roundNumber - b.roundNumber;
                }
                return a.matchNumber - b.matchNumber;
            })
            .slice(0, limit);
    }

    // Reset tournament (for testing)
    resetTournament(tournamentId: string): void {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return;

        // Reset all players
        tournament.players.forEach(player => {
            player.isEliminated = false;
        });

        // Clear all matches
        tournament.matches = [];
        tournament.currentRound = 1;
        tournament.isComplete = false;
        tournament.winner = null;

        // Regenerate first round
        this.generateRoundMatches(tournament, 1);
        
        console.log(`🏆 Tournament ${tournamentId} reset`);
    }

    // Delete tournament
    deleteTournament(tournamentId: string): boolean {
        return this.tournaments.delete(tournamentId);
    }

    // Get all tournaments (for management)
    getAllTournaments(): Tournament[] {
        return Array.from(this.tournaments.values());
    }

    // Export tournament data for saving
    exportTournament(tournamentId: string): string {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        return JSON.stringify(tournament, null, 2);
    }

    // Import tournament data
    importTournament(tournamentData: string): Tournament {
        try {
            const tournament: Tournament = JSON.parse(tournamentData);
            this.tournaments.set(tournament.id, tournament);
            return tournament;
        } catch (error) {
            throw new Error('Invalid tournament data');
        }
    }
}