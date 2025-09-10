import { Tournament, TournamentMatch, TournamentPlayer } from "./TournamentManager";

export class GUIManager {
    private pauseMenu: HTMLElement | null = null;
    private startMenu: HTMLElement | null = null;
    private mainMenu: HTMLElement | null = null;
    private playerSetup: HTMLElement | null = null;
    private tournamentBracket: HTMLElement | null = null;
    private gameUI: HTMLElement | null = null;
    private gameOver: HTMLElement | null = null;
    private tournamentComplete: HTMLElement | null = null;
    private matchResults: HTMLElement | null = null;
    private countdownEl: HTMLElement | null = null;
    private scoreFlashEl: HTMLElement | null = null;
    private defaultTitleImageUrl?: string;

    constructor() {
        this.injectTronStyles();
        this.defaultTitleImageUrl = '/textures/tronpong.png';
    }

    private injectTronStyles(): void {
        if (document.getElementById('tronStyles')) return;

        const style = document.createElement('style');
        style.id = 'tronStyles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
            
            .tron-grid-bg {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: 
                    linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px);
                background-size: 50px 50px;
                animation: gridPulse 4s ease-in-out infinite;
                z-index: -1;
            }
            
            @keyframes gridPulse {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 0.7; }
            }
            
            .tron-container {
                text-align: center;
                background: #000000;
                padding: 50px 40px;
                border: 3px solid #00ffff;
                border-radius: 0;
                box-shadow: 
                    0 0 30px rgba(0, 255, 255, 0.7),
                    0 0 60px rgba(0, 255, 255, 0.3);
                max-width: 600px;
                position: relative;
                font-family: 'Orbitron', 'Courier New', monospace;
                backdrop-filter: blur(5px);
                color: #00ffff;
            }
            
            .tron-title {
                margin: 0;
                font-size: 2.5em;
                font-weight: 900;
                color: #00ffff;
                text-shadow: 
                    0 0 10px #00ffff,
                    0 0 20px #00ffff,
                    0 0 30px #00ffff;
                letter-spacing: 4px;
                animation: titlePulse 2s ease-in-out infinite;
            }
            
            @keyframes titlePulse {
                0%, 100% { text-shadow: 0 0 10px #00ffff, 0 0 20px #00ffff, 0 0 30px #00ffff; }
                50% { text-shadow: 0 0 15px #00ffff, 0 0 30px #00ffff, 0 0 45px #00ffff; }
            }
            
            .tron-button {
                background: linear-gradient(145deg, #001122, #003355);
                border: 2px solid #00ffff;
                color: #00ffff;
                padding: 15px 30px;
                font-family: 'Orbitron', 'Courier New', monospace;
                font-size: 1.1em;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin: 10px;
                box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
            }
            
            .tron-button:hover {
                background: linear-gradient(145deg, #003355, #004477);
                box-shadow: 0 0 25px rgba(0, 255, 255, 0.7);
                transform: translateY(-2px);
            }
            
            .tron-input {
                background: rgba(0, 20, 40, 0.8);
                border: 2px solid #00ffff;
                color: #00ffff;
                padding: 12px 15px;
                font-family: 'Orbitron', 'Courier New', monospace;
                font-size: 1em;
                width: 100%;
                margin: 10px 0;
                box-shadow: inset 0 0 10px rgba(0, 255, 255, 0.2);
            }
            
            .tron-input::placeholder {
                color: rgba(0, 255, 255, 0.6);
            }
            
            .tron-input:focus {
                outline: none;
                box-shadow: 
                    inset 0 0 10px rgba(0, 255, 255, 0.4),
                    0 0 20px rgba(0, 255, 255, 0.6);
            }
            
            .tournament-bracket {
                display: flex;
                gap: 60px;
                justify-content: center;
                align-items: flex-start;
                padding: 20px;
                overflow-x: auto;
            }
            
            .bracket-round {
                display: flex;
                flex-direction: column;
                gap: 20px;
                min-width: 200px;
            }
            
            .bracket-match {
                background: rgba(0, 20, 40, 0.9);
                border: 2px solid #00ffff;
                padding: 15px;
                border-radius: 5px;
                box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
            }
            
            .bracket-match.completed {
                border-color: #00ff88;
                box-shadow: 0 0 15px rgba(0, 255, 136, 0.3);
            }
            
            .bracket-match.active {
                border-color: #ffff00;
                box-shadow: 0 0 15px rgba(255, 255, 0, 0.5);
                animation: activePulse 1.5s ease-in-out infinite;
            }
            
            @keyframes activePulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
            
            .match-player {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid rgba(0, 255, 255, 0.3);
            }
            
            .match-player:last-child {
                border-bottom: none;
            }
            
            .match-player.winner {
                color: #00ff88;
                font-weight: bold;
            }
            
            .player-list {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
                margin: 20px 0;
            }
            
            .player-input-group {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .game-ui-overlay {
                position: fixed;
                top: 10px;
                left: 20px;
                right: 20px;
                z-index: 500;
                pointer-events: none;
            }
            
            .game-scoreboard {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(0, 0, 0, 0.7);
                border: 2px solid #00ffff;
                padding: 6px 20px;
                font-family: 'Orbitron', 'Courier New', monospace;
                color: #00ffff;
                box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
                max-width: 600px;
                margin: 0 auto;
                border-radius: 4px;
            }
            
            .player-score {
                text-align: center;
                min-width: 120px;
            }
            
            .player-name {
                font-size: 0.9em;
                font-weight: bold;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .score-value {
                font-size: 2em;
                font-weight: 900;
                text-shadow: 0 0 15px currentColor;
            }
            
            .game-mode-indicator {
                text-align: center;
                padding: 8px 16px;
                background: rgba(0, 255, 255, 0.1);
                border: 1px solid #00ffff;
                margin: 0 20px;
                border-radius: 3px;
                min-width: 120px;
            }

            .game-mode-indicator .mode-title {
                font-size: 0.8em;
                font-weight: bold;
                margin-bottom: 4px;
                color: #00ffff;
            }

            .game-mode-indicator .mode-subtitle {
                font-size: 0.7em;
                color: #888;
            }
        `;
        document.head.appendChild(style);
    }

    // =====================================
    // MAIN MENU
    // =====================================
    createMainMenu(options: {
        onLocalGame: () => void;
        onAIGame: () => void;
        onTournament: () => void;
        onExitToDashboard: () => void;
    }): void {
        this.removeMainMenu();

        this.mainMenu = document.createElement('div');
        this.mainMenu.id = 'mainMenu';
        this.mainMenu.innerHTML = `
            <div class="tron-container">
                <div class="tron-grid-bg"></div>
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 30px;">
                    <img src="/textures/tronpong.png" alt="TRON PONG" style="max-width:420px; width:80%; filter: drop-shadow(0 0 12px #00ffff); display: block;"/>
                </div>
                <div style="margin: 40px 0;">
                    <button id="localGameBtn" class="tron-button">Local Multiplayer</button>
                    <button id="aiGameBtn" class="tron-button">Play Against AI</button>
                    <button id="tournamentBtn" class="tron-button">Tournament</button>
                </div>
                <div style="margin-top: 20px;">
                    <button id="exitToDashboardBtn" class="tron-button" style="background: linear-gradient(145deg, #2d1b0e, #4a2c1a); border-color: #ff6b35;">Exit to Dashboard</button>
                </div>
                <div style="margin-top: 20px; font-size: 0.9em; color: #888;">
                    Select a game mode to begin
                </div>
            </div>
        `;

        this.mainMenu.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
        `;

        document.body.appendChild(this.mainMenu);

        // Bind events
        document.getElementById('localGameBtn')?.addEventListener('click', options.onLocalGame);
        document.getElementById('aiGameBtn')?.addEventListener('click', options.onAIGame);
        document.getElementById('tournamentBtn')?.addEventListener('click', options.onTournament);
        document.getElementById('exitToDashboardBtn')?.addEventListener('click', options.onExitToDashboard);
    }

    removeMainMenu(): void {
        if (this.mainMenu) {
            this.mainMenu.remove();
            this.mainMenu = null;
        }
    }

    // =====================================
    // PLAYER SETUP
    // =====================================
    createPlayerSetup(options: {
        title: string;
        players: Array<{
            label: string;
            placeholder: string;
            defaultValue: string;
        }>;
        onStart: (playerNames: string[]) => void;
        onBack: () => void;
    }): void {
        this.removePlayerSetup();

        this.playerSetup = document.createElement('div');
        this.playerSetup.id = 'playerSetup';

        const playerInputs = options.players.map((player, index) => `
            <div class="player-input-group">
                <label style="color: #00ffff; font-weight: bold;">${player.label}:</label>
                <input 
                    type="text" 
                    class="tron-input" 
                    id="player${index + 1}Name"
                    placeholder="${player.placeholder}"
                    value="${player.defaultValue}"
                    maxlength="20"
                />
            </div>
        `).join('');

        this.playerSetup.innerHTML = `
            <div class="tron-container">
                <div class="tron-grid-bg"></div>
                <h2 class="tron-title" style="font-size: 2em;">${options.title}</h2>
                <div class="player-list">
                    ${playerInputs}
                </div>
                <div style="margin-top: 30px;">
                    <button id="startGameBtn" class="tron-button">Start Game</button>
                    <button id="backBtn" class="tron-button">Back</button>
                </div>
            </div>
        `;

        this.playerSetup.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
        `;

        document.body.appendChild(this.playerSetup);

        // Bind events
        document.getElementById('startGameBtn')?.addEventListener('click', () => {
            const playerNames: string[] = [];
            options.players.forEach((_, index) => {
                const input = document.getElementById(`player${index + 1}Name`) as HTMLInputElement;
                playerNames.push(input?.value?.trim() || `Player ${index + 1}`);
            });
            options.onStart(playerNames);
        });

        document.getElementById('backBtn')?.addEventListener('click', options.onBack);

        // Focus first input
        setTimeout(() => {
            const firstInput = document.getElementById('player1Name') as HTMLInputElement;
            firstInput?.focus();
        }, 100);
    }

    removePlayerSetup(): void {
        if (this.playerSetup) {
            this.playerSetup.remove();
            this.playerSetup = null;
        }
    }


    // =====================================
    // TOURNAMENT BRACKET
    // =====================================
    createTournamentBracket(tournament: Tournament): void {
        this.removeTournamentBracket();

        const rounds: TournamentMatch[][] = [];
        for (let round = 1; round <= tournament.totalRounds; round++) {
            const roundMatches = tournament.matches.filter(m => m.roundNumber === round);
            rounds.push(roundMatches);
        }

        const roundsHtml = rounds.map((roundMatches, roundIndex) => {
            const roundName = roundIndex === rounds.length - 1 ? 'Final' :
                             roundIndex === rounds.length - 2 ? 'Semi-Final' :
                             `Round ${roundIndex + 1}`;

            const matchesHtml = roundMatches.map(match => {
                const isActive = !match.isComplete && roundIndex + 1 === tournament.currentRound;
                const matchClass = match.isComplete ? 'completed' : (isActive ? 'active' : '');

                return `
                    <div class="bracket-match ${matchClass}">
                        <div style="font-weight: bold; margin-bottom: 10px; color: #00ffff;">
                            Match ${match.matchNumber}
                        </div>
                        <div class="match-player ${match.winner?.id === match.player1.id ? 'winner' : ''}">
                            <span>${match.player1.name}</span>
                            <span>${match.score?.player1 || 0}</span>
                        </div>
                        <div class="match-player ${match.winner?.id === match.player2.id ? 'winner' : ''}">
                            <span>${match.player2.name}</span>
                            <span>${match.score?.player2 || 0}</span>
                        </div>
                        ${match.winner ? `
                            <div style="margin-top: 10px; color: #00ff88; font-weight: bold; text-align: center;">
                                Winner: ${match.winner.name}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            return `
                <div class="bracket-round">
                    <h3 style="color: #00ffff; text-align: center; margin-bottom: 20px;">${roundName}</h3>
                    ${matchesHtml}
                </div>
            `;
        }).join('');

        this.tournamentBracket = document.createElement('div');
        this.tournamentBracket.id = 'tournamentBracket';
        this.tournamentBracket.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.95); z-index: 9998;">
                <div style="padding: 20px; height: 100%; overflow: auto;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h2 class="tron-title">${tournament.name}</h2>
                        <div style="color: #00ffff; margin-top: 10px;">
                            Round ${tournament.currentRound} of ${tournament.totalRounds}
                        </div>
                    </div>
                    <div class="tournament-bracket">
                        ${roundsHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.tournamentBracket);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.removeTournamentBracket();
        }, 3000);
    }

    removeTournamentBracket(): void {
        if (this.tournamentBracket) {
            this.tournamentBracket.remove();
            this.tournamentBracket = null;
        }
    }

    // =====================================
    // GAME UI
    // =====================================
    createGameUI(options: {
        player1Name: string;
        player2Name: string;
        gameMode: 'local' | 'ai' | 'tournament';
    }): void {
        this.removeGameUI();

        this.gameUI = document.createElement('div');
        this.gameUI.id = 'gameUI';
        
        /** For AI games, swap the positions: AI on left, human player on right */
        const isAIGame = options.gameMode === 'ai';
        const leftPlayerName = isAIGame ? options.player2Name : options.player1Name;
        const rightPlayerName = isAIGame ? options.player1Name : options.player2Name;
        
        this.gameUI.innerHTML = `
            <div class="game-ui-overlay">
                <div class="game-scoreboard">
                    <div class="player-score">
                        <div class="player-name">${leftPlayerName}</div>
                        <div class="score-value" id="leftScore">0</div>
                    </div>
                    <div class="game-mode-indicator">
                        <div class="mode-title">
                            ${options.gameMode === 'ai' ? 'Challenge the Computer' : options.gameMode.toUpperCase()}
                        </div>
                        <div class="mode-subtitle">
                            ${options.gameMode === 'local' ? 'Two Players' : 
                              options.gameMode === 'ai' ? 'vs AI' : 'Tournament'}
                        </div>
                    </div>
                    <div class="player-score">
                        <div class="player-name">${rightPlayerName}</div>
                        <div class="score-value" id="rightScore">0</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.gameUI);
    }

    removeGameUI(): void {
        if (this.gameUI) {
            this.gameUI.remove();
            this.gameUI = null;
        }
    }

    // Update scores in game UI
    updateGameScores(leftScore: number, rightScore: number): void {
        const leftScoreEl = document.getElementById('leftScore');
        const rightScoreEl = document.getElementById('rightScore');
        
        if (leftScoreEl) leftScoreEl.textContent = leftScore.toString();
        if (rightScoreEl) rightScoreEl.textContent = rightScore.toString();
    }

    // =====================================
    // GAME OVER
    // =====================================
    createGameOver(options: {
        winner: string;
        score: { left: number; right: number };
        gameMode: any;
        onPlayAgain: () => void;
        onMainMenu: () => void;
    }): void {
        this.removeGameOver();

        // Handle AI games where display positions are swapped
        const isAIGameOver = options.gameMode.type === 'ai';
        let winnerText: string;
        
        if (isAIGameOver) {
            // For AI games: AI is displayed on left, player on right
            winnerText = options.winner === 'left' ?
                options.gameMode.player2Name || 'AI' :  // AI wins (displayed left)
                options.gameMode.player1Name || 'Player'; // Player wins (displayed right)
        } else {
            // For other games: standard left/right mapping
            winnerText = options.winner === 'left' ? 
                options.gameMode.player1Name || 'Player 1' : 
                options.gameMode.player2Name || 'Player 2';
        }

        this.gameOver = document.createElement('div');
        this.gameOver.id = 'gameOver';
        this.gameOver.innerHTML = `
            <div class="tron-container">
                <div class="tron-grid-bg"></div>
                <h2 class="tron-title" style="font-size: 2.5em;">GAME OVER</h2>
                <div style="margin: 30px 0; font-size: 1.5em; color: #00ff88;">
                    🏆 ${winnerText} Wins!
                </div>
                <div style="margin: 20px 0; font-size: 1.2em;">
                    Final Score: ${options.score.left} - ${options.score.right}
                </div>
                <div style="margin-top: 40px;">
                    ${options.gameMode.type !== 'tournament' ? 
                        '<button id="playAgainBtn" class="tron-button">Play Again</button>' : ''}
                    <button id="mainMenuBtn" class="tron-button">Main Menu</button>
                </div>
            </div>
        `;

        this.gameOver.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000;
        `;

        document.body.appendChild(this.gameOver);

        // Bind events
        document.getElementById('playAgainBtn')?.addEventListener('click', options.onPlayAgain);
        document.getElementById('mainMenuBtn')?.addEventListener('click', options.onMainMenu);
    }

    removeGameOver(): void {
        if (this.gameOver) {
            this.gameOver.remove();
            this.gameOver = null;
        }
    }

    // =====================================
    // TOURNAMENT RESULTS
    // =====================================
    createTournamentComplete(options: {
        tournament: Tournament;
        champion: TournamentPlayer;
        onNewTournament: () => void;
        onMainMenu: () => void;
    }): void {
        this.removeTournamentComplete();

        this.tournamentComplete = document.createElement('div');
        this.tournamentComplete.id = 'tournamentComplete';
        this.tournamentComplete.innerHTML = `
            <div class="tron-container">
                <div class="tron-grid-bg"></div>
                <h2 class="tron-title" style="font-size: 2.5em;">TOURNAMENT COMPLETE</h2>
                <div style="margin: 40px 0;">
                    <div style="font-size: 2em; color: #d4af37; margin-bottom: 20px;">
                        🏆 CHAMPION 🏆
                    </div>
                    <div style="font-size: 1.8em; color: #00ff88; font-weight: bold;">
                        ${options.champion.name}
                    </div>
                </div>
                <div style="margin: 30px 0; color: #888;">
                    Tournament: ${options.tournament.name}
                </div>
                <div style="margin-top: 40px;">
                    <button id="newTournamentBtn" class="tron-button">New Tournament</button>
                    <button id="mainMenuBtn" class="tron-button">Main Menu</button>
                </div>
            </div>
        `;

        this.tournamentComplete.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000;
        `;

        document.body.appendChild(this.tournamentComplete);

        // Bind events
        document.getElementById('newTournamentBtn')?.addEventListener('click', options.onNewTournament);
        document.getElementById('mainMenuBtn')?.addEventListener('click', options.onMainMenu);
    }

    createMatchResults(options: {
        winner: string;
        nextMatch: TournamentMatch | null;
        tournament: Tournament;
        onContinue: () => void;
        onMainMenu: () => void;
    }): void {
        this.removeMatchResults();

        this.matchResults = document.createElement('div');
        this.matchResults.id = 'matchResults';
        
        // Check if tournament is complete (no more matches to play)
        const tournamentComplete = !options.nextMatch && (!options.tournament.matches || 
            options.tournament.matches.every((match: any) => match.isComplete));
        
        this.matchResults.innerHTML = `
            <div class="tron-container">
                <div class="tron-grid-bg"></div>
                <h2 class="tron-title" style="font-size: 2em;">MATCH COMPLETE</h2>
                <div style="margin: 30px 0; font-size: 1.5em; color: #00ff88;">
                    Winner: ${options.winner}
                </div>
                ${options.nextMatch ? `
                    <div style="margin: 20px 0;">
                        <div style="color: #00ffff; font-weight: bold; margin-bottom: 10px;">Next Match:</div>
                        <div style="font-size: 1.2em;">
                            ${options.nextMatch.player1.name} vs ${options.nextMatch.player2.name}
                        </div>
                    </div>
                    <div style="margin-top: 40px;">
                        <button id="continueBtn" class="tron-button">Continue Tournament</button>
                    </div>
                ` : tournamentComplete ? `
                    <div style="margin: 20px 0; color: #ffff00; font-weight: bold;">
                        Tournament Complete!
                    </div>
                    <div style="margin-top: 40px;">
                        <button id="continueBtn" class="tron-button">View Final Results</button>
                        <button id="mainMenuBtn" class="tron-button">Main Menu</button>
                    </div>
                ` : `
                    <div style="margin-top: 40px;">
                        <button id="continueBtn" class="tron-button">Continue Tournament</button>
                    </div>
                `}
            </div>
        `;

        this.matchResults.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000;
        `;

        document.body.appendChild(this.matchResults);

        // Bind events
        document.getElementById('continueBtn')?.addEventListener('click', options.onContinue);
        document.getElementById('mainMenuBtn')?.addEventListener('click', options.onMainMenu);
    }

    removeTournamentComplete(): void {
        if (this.tournamentComplete) {
            this.tournamentComplete.remove();
            this.tournamentComplete = null;
        }
    }

    removeMatchResults(): void {
        if (this.matchResults) {
            this.matchResults.remove();
            this.matchResults = null;
        }
    }

    createPauseMenu(options?: { 
        onResume?: () => void; 
        onRestart?: () => void;
        onMainMenu?: () => void;
        onQuitToDashboard?: () => void;
    }): void {
        this.removePauseMenu();

        this.pauseMenu = document.createElement('div');
        this.pauseMenu.id = 'pauseMenu';
        this.pauseMenu.innerHTML = `
            <div class="tron-container">
                <div class="tron-grid-bg"></div>
                <h2 class="tron-title" style="font-size: 2em;">GAME PAUSED</h2>
                <div style="margin: 30px 0; font-size: 1.2em;">
                    Press <span style="color: #d4af37; font-weight: bold;">SPACE</span> to resume
                </div>
                <div style="margin-top: 40px;">
                    <button id="resumeBtn" class="tron-button">Resume Game</button>
                    <button id="restartBtn" class="tron-button">Restart Game</button>
                    <button id="gameMenuBtn" class="tron-button">Game Menu</button>
                    <button id="quitToDashboardBtn" class="tron-button" style="background: linear-gradient(145deg, #440011, #660022); border-color: #ff4466;">Exit to Dashboard</button>
                </div>
                <div style="margin-top: 30px; font-size: 0.9em; color: #888;">
                    <div style="margin-bottom: 10px;">Controls:</div>
                    <div>SPACE - Resume | ESC/Q - Dashboard | R - Restart</div>
                </div>
            </div>
        `;

        this.pauseMenu.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000;
        `;

        document.body.appendChild(this.pauseMenu);

        // Bind events
        document.getElementById('resumeBtn')?.addEventListener('click', () => options?.onResume?.());
        document.getElementById('restartBtn')?.addEventListener('click', () => options?.onRestart?.());
        document.getElementById('gameMenuBtn')?.addEventListener('click', () => options?.onMainMenu?.());
        document.getElementById('quitToDashboardBtn')?.addEventListener('click', () => options?.onQuitToDashboard?.());
    }

    removePauseMenu(): void {
        if (this.pauseMenu) {
            this.pauseMenu.remove();
            this.pauseMenu = null;
        }
    }

    createStartMenu(options?: { titleImageUrl?: string }): void {
        this.removeStartMenu();

        this.startMenu = document.createElement('div');
        this.startMenu.id = 'startMenu';
        const effectiveTitleImage = options?.titleImageUrl ?? this.defaultTitleImageUrl;
        const titleBlock = effectiveTitleImage
            ? `<img src="${effectiveTitleImage}" alt="Title" style="max-width:420px; width:80%; filter: drop-shadow(0 0 12px #00ffff);"/>`
            : `<h1 class="tron-title">TRONPONG</h1>`;

        this.startMenu.innerHTML = `
            <div class="tron-container">
                <div class="tron-grid-bg"></div>
                <div style="margin-bottom: 30px;">
                    ${titleBlock}
                </div>
                <div style="margin: 30px 0; font-size: 1.2em;">
                    Press <span style="color: #d4af37; font-weight: bold;">SPACE</span> to start
                </div>
            </div>
        `;

        this.startMenu.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
        `;

        document.body.appendChild(this.startMenu);
    }

    removeStartMenu(): void {
        if (this.startMenu) {
            this.startMenu.remove();
            this.startMenu = null;
        }
    }

    updateCountdown(value: number | string): void {
        if (!this.countdownEl) {
            this.countdownEl = document.createElement('div');
            this.countdownEl.id = 'countdownOverlay';
            this.countdownEl.className = 'game-countdown-overlay'; // Add class for easier cleanup
            this.countdownEl.setAttribute('data-game-element', 'countdown'); // Add data attribute
            this.countdownEl.style.cssText = `
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                display: flex; align-items: center; justify-content: center;
                z-index: 10000; pointer-events: none;
                color: #00ffff;
                text-shadow: 0 0 20px #00ffff, 0 0 40px #00ffff;
                font-family: 'Orbitron', 'Courier New', monospace;
                background: rgba(0,0,0,0.3);
            `;
            
            // Try to append to game container first, fall back to body
            const gameContainer = document.getElementById('gameContainer') || document.getElementById('main-content') || document.body;
            gameContainer.appendChild(this.countdownEl);
            // Countdown attached to game container
        }
        const content = typeof value === 'number' ? value.toString() : value;
        this.countdownEl.innerHTML = `
            <div style="font-size: 96px; font-weight: 900; letter-spacing: 4px;">
                ${content}
            </div>
        `;
    }

    clearCountdown(): void {
        if (this.countdownEl) {
            this.countdownEl.remove();
            this.countdownEl = null;
        }
    }

    showScoreFlash(options: { 
        scorer: 'left' | 'right'; 
        leftScore: number; 
        rightScore: number; 
        imageUrl?: string; 
        durationMs?: number;
    }): void {
        this.clearScoreFlash();
        this.scoreFlashEl = document.createElement('div');
        this.scoreFlashEl.id = 'scoreFlashOverlay';
        const { scorer, leftScore, rightScore, imageUrl } = options;
        const duration = options.durationMs ?? 500;
        const titleText = scorer === 'left' ? 'LEFT SCORES!' : 'RIGHT SCORES!';
        const content = imageUrl ? 
            `<img src="${imageUrl}" alt="Score" style="max-height:160px; filter: drop-shadow(0 0 12px #00ffff);"/>` : 
            `<div style="font-size:64px;font-weight:900;letter-spacing:3px;">${titleText}</div>`;
        
        this.scoreFlashEl.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            display:flex;align-items:center;justify-content:center;
            z-index:10005;pointer-events:none;
            background:radial-gradient(circle at center, rgba(0,255,255,0.15), rgba(0,0,0,0.0));
            font-family:'Orbitron','Courier New',monospace;color:#00ffff;
            animation: scoreFlashFade ${duration}ms ease-out forwards;
        `;
        
        this.scoreFlashEl.innerHTML = `
            <div style="text-align:center;">
                ${content}
                <div style="margin-top:12px;font-size:20px;letter-spacing:2px;text-shadow:0 0 8px #00ffff;">
                    ${leftScore} : ${rightScore}
                </div>
            </div>`;
        
        if (!document.getElementById('scoreFlashKeyframes')) {
            const style = document.createElement('style');
            style.id = 'scoreFlashKeyframes';
            style.textContent = `@keyframes scoreFlashFade {0%{opacity:0;}10%{opacity:1;}90%{opacity:1;}100%{opacity:0;}}`;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(this.scoreFlashEl);
        
        // Update game UI scores
        this.updateGameScores(leftScore, rightScore);
        
        setTimeout(() => this.clearScoreFlash(), duration);
    }

    clearScoreFlash(): void {
        if (this.scoreFlashEl) {
            this.scoreFlashEl.remove();
            this.scoreFlashEl = null;
        }
    }



    dispose(): void {
        this.removeMainMenu();
        this.removePlayerSetup();
        this.removeTournamentBracket();
        this.removeGameUI();
        this.removeGameOver();
        this.removeTournamentComplete();
        this.removeMatchResults();
        this.removePauseMenu();
        this.removeStartMenu();
        this.clearCountdown();
        this.clearScoreFlash();
        

        
        const styles = document.getElementById('tronStyles');
        if (styles) {
            styles.remove();
        }
    }
}