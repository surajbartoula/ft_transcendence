// =====================================
// SCORE MANAGER
// =====================================
 export class ScoreManager {
    private leftScore: number = 0;
    private rightScore: number = 0;
    private onScoreChange?: (info: { leftScore: number; rightScore: number; scorer: 'left' | 'right' }) => void;

    initialize(): void {
        console.log("📊 Score manager initialized");
    }

    setScoreChangeCallback(callback: (info: { leftScore: number; rightScore: number; scorer: 'left' | 'right' }) => void): void {
        this.onScoreChange = callback;
    }

    scorePoint(side: 'left' | 'right'): void {
        if (side === 'left') {
            this.leftScore++;
        } else {
            this.rightScore++;
        }
        
        console.log(`🎯 ${side} player scores! Score: ${this.leftScore} - ${this.rightScore}`);
        
        if (this.onScoreChange) {
            this.onScoreChange({ leftScore: this.leftScore, rightScore: this.rightScore, scorer: side });
        }
    }

    getScore(): { left: number, right: number } {
        return { left: this.leftScore, right: this.rightScore };
    }

    reset(): void {
        this.leftScore = 0;
        this.rightScore = 0;
        
        if (this.onScoreChange) {
            this.onScoreChange({ leftScore: this.leftScore, rightScore: this.rightScore, scorer: 'left' });
        }
    }
}