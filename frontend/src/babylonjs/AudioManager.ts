// =====================================
// SUPPORTING SYSTEMS
// =====================================
export class AudioManager {
    initialize(): void {
        console.log("🔊 Audio manager initialized");
    }

    play(soundName: string): void {
        console.log(`🔊 Playing sound: ${soundName}`);
    }

    dispose(): void {}
}