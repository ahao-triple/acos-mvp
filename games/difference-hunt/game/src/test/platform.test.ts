import { describe, expect, test, vi } from 'vitest';

import { createWebPlatformAdapter } from '../platform/web';

describe('web platform audio', () => {
  test('plays music and sfx from the expected asset paths', async () => {
    const instances: MockAudio[] = [];
    const originalAudio = globalThis.Audio;
    (globalThis as any).Audio = class MockAudio {
      src = '';
      loop = false;
      paused = true;
      currentTime = 0;
      preload = 'auto';
      play = vi.fn(async () => {
        this.paused = false;
      });
      pause = vi.fn(() => {
        this.paused = true;
      });
      constructor() {
        instances.push(this);
      }
    };

    try {
      const adapter = createWebPlatformAdapter();
      await (adapter as any).playMusic('bgm', true);
      await adapter.playSfx('tap');

      expect(instances).toHaveLength(2);
      expect(instances[0]?.src).toBe('/audio/bgm.mp3');
      expect(instances[0]?.loop).toBe(true);
      expect(instances[1]?.src).toBe('/audio/tap.wav');
    } finally {
      (globalThis as any).Audio = originalAudio;
    }
  });

  test('surfaces blocked music playback so it can be retried later', async () => {
    const originalAudio = globalThis.Audio;
    let attempts = 0;
    (globalThis as any).Audio = class MockAudio {
      src = '';
      loop = false;
      paused = true;
      currentTime = 0;
      preload = 'auto';
      play = vi.fn(async () => {
        attempts += 1;
        throw new Error('blocked');
      });
      pause = vi.fn(() => {
        this.paused = true;
      });
    };

    try {
      const adapter = createWebPlatformAdapter();
      await expect(adapter.playMusic('bgm', true)).rejects.toThrow('blocked');
      expect(attempts).toBe(1);
    } finally {
      (globalThis as any).Audio = originalAudio;
    }
  });
});

class MockAudio {
  src = '';
  loop = false;
  paused = true;
  currentTime = 0;
  preload = 'auto';
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
}
