import { GUIManager } from "./GuiManager";
import { Tournament, TournamentMatch, TournamentPlayer } from "./TournamentManager";

interface GameMode {
    type: 'local' | 'ai' | 'tournament';
    player1Name?: string;
    player2Name?: string;
    tournamentId?: string;
}

export class UIManager {
    private gui = new GUIManager();
    private currentMenus: Set<string> = new Set();

    initialize(): void {
        console.log("🖥️ UI manager initialized");
    }

    // =====================================
    // MAIN MENU
    // =====================================
    showMainMenu(options: {
        onLocalGame: () => void;
        onAIGame: () => void;
        onTournament: () => void;
        onExitToDashboard: () => void;
    }): void {
        this.gui.createMainMenu(options);
        this.currentMenus.add('mainMenu');
    }

    hideMainMenu(): void {
        this.gui.removeMainMenu();
        this.currentMenus.delete('mainMenu');
    }

    // =====================================
    // PLAYER SETUP
    // =====================================
    showPlayerSetup(options: {
        title: string;
        players: Array<{
            label: string;
            placeholder: string;
            defaultValue: string;
        }>;
        onStart: (playerNames: string[]) => void;
        onBack: () => void;
    }): void {
        this.gui.createPlayerSetup(options);
        this.currentMenus.add('playerSetup');
    }

    hidePlayerSetup(): void {
        this.gui.removePlayerSetup();
        this.currentMenus.delete('playerSetup');
    }


    // =====================================
    // TOURNAMENT BRACKET
    // =====================================
    showTournamentBracket(tournament: Tournament): void {
        this.gui.createTournamentBracket(tournament);
        this.currentMenus.add('tournamentBracket');
    }

    hideTournamentBracket(): void {
        this.gui.removeTournamentBracket();
        this.currentMenus.delete('tournamentBracket');
    }

    // =====================================
    // GAME UI
    // =====================================
    showGameUI(options: {
        player1Name: string;
        player2Name: string;
        gameMode: 'local' | 'ai' | 'tournament';
    }): void {
        this.gui.createGameUI(options);
        this.currentMenus.add('gameUI');
    }

    hideGameUI(): void {
        this.gui.removeGameUI();
        this.currentMenus.delete('gameUI');
    }

    // =====================================
    // GAME OVER
    // =====================================
    showGameOver(options: {
        winner: string;
        score: { left: number; right: number };
        gameMode: GameMode;
        onPlayAgain: () => void;
        onMainMenu: () => void;
    }): void {
        this.gui.createGameOver(options);
        this.currentMenus.add('gameOver');
    }

    hideGameOver(): void {
        this.gui.removeGameOver();
        this.currentMenus.delete('gameOver');
    }

    // =====================================
    // TOURNAMENT RESULTS
    // =====================================
    showTournamentComplete(options: {
        tournament: Tournament;
        champion: TournamentPlayer;
        onNewTournament: () => void;
        onMainMenu: () => void;
    }): void {
        this.gui.createTournamentComplete(options);
        this.currentMenus.add('tournamentComplete');
    }

    showMatchResults(options: {
        winner: string;
        nextMatch: TournamentMatch | null;
        tournament: Tournament;
        onContinue: () => void;
        onMainMenu: () => void;
    }): void {
        this.gui.createMatchResults(options);
        this.currentMenus.add('matchResults');
    }

    hideTournamentResults(): void {
        this.gui.removeTournamentComplete();
        this.gui.removeMatchResults();
        this.currentMenus.delete('tournamentComplete');
        this.currentMenus.delete('matchResults');
    }
	
    showStart(options?: { titleImageUrl?: string }): void {
        this.gui.createStartMenu(options);
        this.currentMenus.add('startMenu');
    }

    hideStart(): void {
        this.gui.removeStartMenu();
        this.currentMenus.delete('startMenu');
    }

    showPause(options?: { 
        onResume?: () => void; 
        onRestart?: () => void;
        onMainMenu?: () => void;
        onQuitToDashboard?: () => void;
    }): void {
        this.gui.createPauseMenu(options);
        this.currentMenus.add('pauseMenu');
    }

    hidePause(): void {
        this.gui.removePauseMenu();
        this.currentMenus.delete('pauseMenu');
    }

    showCountdown(value: number | string): void {
        this.gui.updateCountdown(value);
    }

    clearCountdown(): void {
        this.gui.clearCountdown();
    }

    showScoreFlash(params: { 
        scorer: 'left' | 'right'; 
        leftScore: number; 
        rightScore: number; 
        imageUrl?: string; 
        durationMs?: number;
    }): void {
        this.gui.showScoreFlash(params);
    }

    clearScoreFlash(): void {
        this.gui.clearScoreFlash();
    }

    // =====================================
    // UTILITY METHODS
    // =====================================
    update(deltaTime: number): void {
        // Update any animated UI elements
    }

    render(): void {
        // Render any overlay UI
    }

    hideAllMenus(): void {
        this.currentMenus.forEach(menu => {
            switch (menu) {
                case 'mainMenu': this.hideMainMenu(); break;
                case 'playerSetup': this.hidePlayerSetup(); break;
                case 'tournamentBracket': this.hideTournamentBracket(); break;
                case 'gameUI': this.hideGameUI(); break;
                case 'gameOver': this.hideGameOver(); break;
                case 'tournamentComplete': 
                case 'matchResults': this.hideTournamentResults(); break;
                case 'startMenu': this.hideStart(); break;
                case 'pauseMenu': this.hidePause(); break;
            }
        });
        this.currentMenus.clear();
    }

    dispose(): void {
        this.hideAllMenus();
        this.clearCountdown(); // Explicitly clear countdown on disposal
        this.gui.dispose();
    }
}