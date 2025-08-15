export class GUIManager {
    private pauseMenu: HTMLElement | null = null;
    private startMenu: HTMLElement | null = null;
    private countdownEl: HTMLElement | null = null;
    private scoreFlashEl: HTMLElement | null = null;
    // Default assets/config
    private defaultTitleImageUrl?: string;

    constructor() {
        this.injectTronStyles();
        // Set default title image used by the Start Menu if none is provided by callers
        this.defaultTitleImageUrl = './textures/tronpong.png';
    }

    private injectTronStyles(): void {
        // Only inject styles once
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
            
            .pause-content {
                text-align: center;
                background: #000000;
                padding: 50px 40px;
                border: 3px solid #00ffff;
                border-radius: 0;
                box-shadow: 
                    0 0 30px rgba(0, 255, 255, 0.7),
                    0 0 60px rgba(0, 255, 255, 0.3);
                max-width: 500px;
                position: relative;
                font-family: 'Orbitron', 'Courier New', monospace;
                backdrop-filter: blur(5px);
            }
            
            .title-container {
                margin-bottom: 30px;
            }
            
            .tron-title {
                margin: 0;
                font-size: 3em;
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
            
            .title-underline {
                width: 100%;
                height: 2px;
                background: linear-gradient(90deg, transparent, #00ffff, transparent);
                margin: 15px auto;
                animation: underlineGlow 3s ease-in-out infinite;
            }
            
            @keyframes underlineGlow {
                0%, 100% { box-shadow: 0 0 5px #00ffff; }
                50% { box-shadow: 0 0 15px #00ffff; }
            }
            
            .resume-prompt {
                font-size: 1.4em;
                margin: 25px 0;
                color: #d4af37;
                text-shadow: 0 0 10px #d4af37;
                animation: promptBlink 1.5s ease-in-out infinite;
            }
            
            @keyframes promptBlink {
                0%, 50%, 100% { opacity: 1; }
                25%, 75% { opacity: 0.6; }
            }
            
            .key-highlight {
                padding: 8px 16px;
                background: linear-gradient(145deg, #d4af37, #b8860b);
                color: #000;
                border-radius: 4px;
                font-weight: bold;
                box-shadow: 
                    0 0 15px rgba(212, 175, 55, 0.6),
                    inset 0 2px 0 rgba(255, 255, 255, 0.3);
                text-shadow: none;
            }
            
            .pause-controls {
                margin-top: 40px;
                padding: 25px 0;
                border-top: 2px solid rgba(0, 255, 255, 0.5);
                border-image: linear-gradient(90deg, transparent, #00ffff, transparent) 1;
            }
            
            .control-header {
                font-size: 1.2em;
                color: #00ff88;
                margin-bottom: 20px;
                text-shadow: 0 0 8px #00ff88;
                letter-spacing: 2px;
            }
            
            .control-grid {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .control-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: rgba(0, 255, 255, 0.05);
                border: 1px solid rgba(0, 255, 255, 0.2);
                transition: all 0.3s ease;
            }
            
            .control-row:hover {
                background: rgba(0, 255, 255, 0.1);
                border-color: rgba(0, 255, 255, 0.4);
                box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
            }
            
            .control-label {
                font-size: 0.95em;
                color: #88ccff;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .control-keys {
                display: flex;
                gap: 5px;
            }
            
            .key {
                padding: 4px 8px;
                background: linear-gradient(145deg, #001122, #003355);
                border: 1px solid #00ffff;
                border-radius: 3px;
                color: #00ffff;
                font-size: 0.9em;
                font-weight: bold;
                text-shadow: 0 0 5px #00ffff;
                box-shadow: 
                    0 2px 4px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(0, 255, 255, 0.2);
                min-width: 20px;
                text-align: center;
            }

            /* Coordinate display styling */
            .coordinate-display {
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.9);
                color: #ff0000ff;
                padding: 15px;
                border: 1px solid #00ffff;
                border-radius: 0;
                font-family: 'Orbitron', 'Courier New', monospace;
                font-size: 14px;
                z-index: 1000;
                pointer-events: none;
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
                text-shadow: 0 0 5px #00ffff;
            }
        `;
        document.head.appendChild(style);
    }

    public createPauseMenu(options?: { onResume?: () => void; onRestart?: () => void }): void {
        // Remove existing pause menu if it exists
        this.removePauseMenu();

        // Create pause menu overlay
        this.pauseMenu = document.createElement('div');
        this.pauseMenu.id = 'pauseMenu';
        this.pauseMenu.innerHTML = `
            <div class="pause-content">
                <div class="title-container">
                    <h2 class="tron-title">SYSTEM PAUSED</h2>
                    <div class="title-underline"></div>
                </div>
                <div class="resume-prompt">
                    <span class="key-highlight">SPACE</span> TO RESUME
                </div>
                <div style="margin-top: 10px;">
                    <button id="restartButton" style="cursor:pointer;padding:10px 16px;border:2px solid #00ffff;background:black;color:#00ffff;font-family:'Orbitron','Courier New',monospace;text-shadow:0 0 10px #00ffff;box-shadow:0 0 15px rgba(0,255,255,0.5);">
                        RESTART
                    </button>
                </div>
                <div class="pause-controls">
                    <div class="control-header">CONTROL INTERFACE</div>
                    <div class="control-grid">
                        <div class="control-row">
                            <span class="control-label">LEFT PADDLE</span>
                            <span class="control-keys"><span class="key">A</span>/<span class="key">D</span></span>
                        </div>
                        <div class="control-row">
                            <span class="control-label">RIGHT PADDLE</span>
                            <span class="control-keys"><span class="key">←</span>/<span class="key">→</span></span>
                        </div>
                        <div class="control-row">
                            <span class="control-label">CAMERA LOCK</span>
                            <span class="control-keys"><span class="key">L</span></span>
                        </div>
                        <div class="control-row">
                            <span class="control-label">DEBUG INFO</span>
                            <span class="control-keys"><span class="key">C</span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Style the pause menu with Tron theme
        this.pauseMenu.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: 'Courier New', 'Monaco', monospace;
            color: #00ffff;
            overflow: hidden;
        `;

        document.body.appendChild(this.pauseMenu);

        // Wire callbacks
        const restartBtn = this.pauseMenu.querySelector('#restartButton') as HTMLButtonElement | null;
        if (restartBtn && options?.onRestart) {
            restartBtn.addEventListener('click', () => options.onRestart && options.onRestart());
        }
    }

    public removePauseMenu(): void {
        if (this.pauseMenu) {
            this.pauseMenu.remove();
            this.pauseMenu = null;
        }
    }

    public isPauseMenuVisible(): boolean {
        return this.pauseMenu !== null;
    }

    public displayCoordinateOnPage(meshName: string, position: { x: number; y: number; z: number }): void {
        // Remove existing coordinate display
        const existing = document.getElementById('coordinateDisplay');
        if (existing) existing.remove();

        // Create coordinate display element
        const display = document.createElement('div');
        display.id = 'coordinateDisplay';
        display.className = 'coordinate-display';
        display.innerHTML = `
            <strong>${meshName}</strong><br>
            X: ${position.x.toFixed(2)}<br>
            Y: ${position.y.toFixed(2)}<br>
            Z: ${position.z.toFixed(2)}
        `;
        
        document.body.appendChild(display);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            const element = document.getElementById('coordinateDisplay');
            if (element) {
                element.remove();
            }
        }, 3000);
    }

    public dispose(): void {
        this.removePauseMenu();
        
        // Remove injected styles
        const styles = document.getElementById('tronStyles');
        if (styles) {
            styles.remove();
        }
    }

    // ===== Start Menu =====
    public createStartMenu(options?: { titleImageUrl?: string }): void {
        this.removeStartMenu();

        this.startMenu = document.createElement('div');
        this.startMenu.id = 'startMenu';
    const effectiveTitleImage = options?.titleImageUrl ?? this.defaultTitleImageUrl;
    const titleBlock = effectiveTitleImage
            ? `<div class="title-container">
            <img src="${effectiveTitleImage}" alt="Title" style="max-width:420px; width:80%; filter: drop-shadow(0 0 12px #00ffff);"/>
                    <div class="title-underline"></div>
               </div>`
            : `<div class="title-container">
                    <h1 class="tron-title">TRONPONG</h1>
                    <div class="title-underline"></div>
               </div>`;
        this.startMenu.innerHTML = `
            <div class="pause-content">
                ${titleBlock}
                <div class="resume-prompt">
                    PRESS <span class="key-highlight">SPACE</span> TO START
                </div>
                <div class="pause-controls">
                    <div class="control-header">CONTROLS</div>
                    <div class="control-grid">
                        <div class="control-row">
                            <span class="control-label">LEFT PADDLE</span>
                            <span class="control-keys"><span class="key">←</span>/<span class="key">→</span></span>
                        </div>
                        <div class="control-row">
                            <span class="control-label">RIGHT PADDLE</span>
                            <span class="control-keys"><span class="key">A</span>/<span class="key">D</span></span>
                        </div>
                        <div class="control-row">
                            <span class="control-label">PAUSE/RESUME</span>
                            <span class="control-keys"><span class="key">SPACE</span></span>
                        </div>
                        
                    </div>
                </div>
            </div>
        `;

        this.startMenu.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            font-family: 'Courier New', 'Monaco', monospace;
            color: #00ffff;
            overflow: hidden;
        `;

        document.body.appendChild(this.startMenu);
    }

    public removeStartMenu(): void {
        if (this.startMenu) {
            this.startMenu.remove();
            this.startMenu = null;
        }
    }

    // ===== Countdown Overlay =====
    public updateCountdown(value: number | string): void {
        if (!this.countdownEl) {
            this.countdownEl = document.createElement('div');
            this.countdownEl.id = 'countdownOverlay';
            this.countdownEl.style.cssText = `
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                display: flex; align-items: center; justify-content: center;
                z-index: 10000; pointer-events: none;
                color: #00ffff;
                text-shadow: 0 0 20px #00ffff, 0 0 40px #00ffff;
                font-family: 'Orbitron', 'Courier New', monospace;
                background: rgba(0,0,0,0.2);
            `;
            document.body.appendChild(this.countdownEl);
        }
        const content = typeof value === 'number' ? value.toString() : value;
        this.countdownEl.innerHTML = `
            <div style="font-size: 96px; font-weight: 900; letter-spacing: 4px;">
                ${content}
            </div>
        `;
    }

    public clearCountdown(): void {
        if (this.countdownEl) {
            this.countdownEl.remove();
            this.countdownEl = null;
        }
    }

    // ===== Score Flash Overlay =====
    public showScoreFlash(options: { scorer: 'left' | 'right'; leftScore: number; rightScore: number; imageUrl?: string; durationMs?: number }): void {
        // Clear existing first
        this.clearScoreFlash();
        this.scoreFlashEl = document.createElement('div');
        this.scoreFlashEl.id = 'scoreFlashOverlay';
        const { scorer, leftScore, rightScore, imageUrl } = options;
        const duration = options.durationMs ?? 1800;
        const titleText = scorer === 'left' ? 'LEFT SCORES!' : 'RIGHT SCORES!';
        const content = imageUrl ? `<img src="${imageUrl}" alt="Score" style="max-height:160px; filter: drop-shadow(0 0 12px #00ffff);"/>` : `<div style="font-size:64px;font-weight:900;letter-spacing:3px;">${titleText}</div>`;
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
        // Inject keyframes if not present
        if (!document.getElementById('scoreFlashKeyframes')) {
            const style = document.createElement('style');
            style.id = 'scoreFlashKeyframes';
            style.textContent = `@keyframes scoreFlashFade {0%{opacity:0;}10%{opacity:1;}90%{opacity:1;}100%{opacity:0;}}`;
            document.head.appendChild(style);
        }
        document.body.appendChild(this.scoreFlashEl);
        setTimeout(() => this.clearScoreFlash(), duration);
    }

    public clearScoreFlash(): void {
        if (this.scoreFlashEl) {
            this.scoreFlashEl.remove();
            this.scoreFlashEl = null;
        }
    }
}
