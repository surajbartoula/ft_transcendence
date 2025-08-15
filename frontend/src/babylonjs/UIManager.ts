import { GUIManager } from "./GuiManager";

export class UIManager {
	private gui = new GUIManager();

	initialize(): void {
		console.log("🖥️ UI manager initialized");
	}

	// Start Menu
	showStart(options?: { titleImageUrl?: string }): void { this.gui.createStartMenu(options); }
	hideStart(): void { this.gui.removeStartMenu(); }

	// Pause Menu
	showPause(options?: { onResume?: () => void; onRestart?: () => void }): void { this.gui.createPauseMenu(options); }
	hidePause(): void { this.gui.removePauseMenu(); }

	// Countdown
	showCountdown(value: number | string): void { this.gui.updateCountdown(value); }
	clearCountdown(): void { this.gui.clearCountdown(); }

	// Score flash
	showScoreFlash(params: { scorer: 'left' | 'right'; leftScore: number; rightScore: number; imageUrl?: string; durationMs?: number }): void {
		this.gui.showScoreFlash(params);
	}
	clearScoreFlash(): void { this.gui.clearScoreFlash(); }

	update(deltaTime: number): void {}
	render(): void {}
	dispose(): void { this.gui.dispose(); }
}