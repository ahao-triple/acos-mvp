import { describe, expect, test } from 'vitest';
import { SOUND_ASSETS, INITIAL_SOUND_ASSET_TYPES, MUSIC_ASSET, SOUND_ASSET_BUDGET_BYTES } from '../audio/soundAssets';
import {
  SoundEngine,
  soundPlanForCue,
  type AudioCue,
  type SoundAssetPlayer,
  type SynthAudioContext,
} from '../audio/soundEngine';

describe('sound engine', () => {
  test('declares packaged wav assets for every cue within a conservative budget', () => {
    expect(Object.keys(SOUND_ASSETS).sort()).toEqual(['button', 'combo', 'invalid', 'lose', 'match', 'reward', 'select', 'win'].sort());
    expect(Object.values(SOUND_ASSETS).every((asset) => asset.src.startsWith('/audio/') && asset.src.endsWith('.wav'))).toBe(true);
    expect(INITIAL_SOUND_ASSET_TYPES).toEqual(['button', 'select', 'invalid', 'match']);
    expect(SOUND_ASSET_BUDGET_BYTES).toBeLessThanOrEqual(900_000);
  });

  test('declares a looped mp3 music asset', () => {
    expect(MUSIC_ASSET.src).toBe('/audio/bgm.mp3');
    expect(MUSIC_ASSET.src.endsWith('.mp3')).toBe(true);
    expect(MUSIC_ASSET.loop).toBe(true);
    expect(MUSIC_ASSET.volume).toBeLessThan(0.4);
  });

  test('keeps generated tone plans available as a fallback', () => {
    const plan = soundPlanForCue({ type: 'match', id: 1 });

    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((tone) => tone.durationMs <= 220)).toBe(true);
    expect(plan.every((tone) => tone.gain <= 0.08)).toBe(true);
  });

  test('prefers packaged assets over generated fallback tones', async () => {
    const scheduled: string[] = [];
    const played: string[] = [];
    const engine = new SoundEngine({
      createContext: () => fakeContext(scheduled),
      createAssetPlayer: (asset) => fakeAssetPlayer(asset.type, played),
    });

    await expect(engine.play({ type: 'button', id: 1 }, true)).resolves.toBe(true);

    expect(played).toEqual(['button']);
    expect(scheduled).not.toContain('start');
  });

  test('falls back to generated tones when packaged asset playback fails', async () => {
    const scheduled: string[] = [];
    const engine = new SoundEngine({
      createContext: () => fakeContext(scheduled),
      createAssetPlayer: (asset) => fakeAssetPlayer(asset.type, [], true),
    });

    await expect(engine.play({ type: 'reward', id: 2 }, true)).resolves.toBe(true);

    expect(scheduled.filter((entry) => entry === 'start').length).toBeGreaterThan(0);
  });

  test('deduplicates cues and respects disabled sound setting', async () => {
    const scheduled: string[] = [];
    const played: string[] = [];
    const engine = new SoundEngine({
      createContext: () => fakeContext(scheduled),
      createAssetPlayer: (asset) => fakeAssetPlayer(asset.type, played),
    });
    const cue: AudioCue = { type: 'button', id: 7 };

    await expect(engine.play(cue, false)).resolves.toBe(false);
    await expect(engine.play(cue, true)).resolves.toBe(true);
    await expect(engine.play(cue, true)).resolves.toBe(false);
    expect(played).toEqual(['button']);
    expect(scheduled).not.toContain('start');
  });

  test('starts and stops looped background music from the music setting', async () => {
    const events: string[] = [];
    const engine = new SoundEngine({
      createContext: () => fakeContext([]),
      createMusicPlayer: (asset) => fakeMusicPlayer(asset.src, events),
    });

    await expect(engine.syncMusic(true)).resolves.toBe(true);
    await expect(engine.syncMusic(true)).resolves.toBe(false);
    await expect(engine.syncMusic(false)).resolves.toBe(true);

    expect(events).toEqual(['play:/audio/bgm.mp3:0.22', 'pause:/audio/bgm.mp3']);
  });
});

function fakeAssetPlayer(type: string, played: string[], fail = false): SoundAssetPlayer {
  return {
    preload() {
      played.push(`preload:${type}`);
    },
    async play() {
      if (fail) {
        throw new Error('asset playback failed');
      }
      played.push(type);
    },
  };
}

function fakeContext(scheduled: string[]): SynthAudioContext {
  return {
    currentTime: 1,
    state: 'running',
    destination: {},
    async resume() {
      scheduled.push('resume');
    },
    createOscillator() {
      return {
        type: 'sine',
        frequency: {
          setValueAtTime(value: number) {
            scheduled.push(`frequency:${value}`);
          },
          linearRampToValueAtTime(value: number) {
            scheduled.push(`frequency-fade:${value}`);
          },
          exponentialRampToValueAtTime(value: number) {
            scheduled.push(`glide:${value}`);
          },
        },
        connect() {
          scheduled.push('osc-connect');
        },
        start() {
          scheduled.push('start');
        },
        stop() {
          scheduled.push('stop');
        },
      };
    },
    createGain() {
      return {
        gain: {
          setValueAtTime(value: number) {
            scheduled.push(`gain:${value}`);
          },
          linearRampToValueAtTime(value: number) {
            scheduled.push(`fade:${value}`);
          },
        },
        connect() {
          scheduled.push('gain-connect');
        },
      };
    },
  };
}

function fakeMusicPlayer(src: string, events: string[]) {
  return {
    async play(volume: number) {
      events.push(`play:${src}:${volume}`);
    },
    pause() {
      events.push(`pause:${src}`);
    },
  };
}
