import { normalizeSoundName } from './soundAssets';
import type { MiniPackGameRuntime } from '../platform/minipack';

export class SoundEngine {
  private unlocked = false;

  constructor(
    private readonly options: {
      runtime?: MiniPackGameRuntime;
      baseUrl: string;
    },
  ) {}

  unlock(): void {
    this.unlocked = true;
  }

  async play(name: string | undefined, enabled: boolean): Promise<void> {
    const sound = normalizeSoundName(name);
    if (!enabled || !sound) {
      return;
    }
    if (this.options.runtime) {
      await this.options.runtime.audio.playSfx(sound);
      return;
    }
    if (!this.unlocked || typeof Audio === 'undefined') {
      return;
    }
    try {
      const audio = new Audio(`${this.options.baseUrl}assets/audio/sfx/${sound}.wav`);
      audio.volume = 0.65;
      await audio.play();
    } catch {
      return;
    }
  }
}
