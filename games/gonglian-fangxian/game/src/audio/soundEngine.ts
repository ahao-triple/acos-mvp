import { INITIAL_SOUND_ASSET_TYPES, MUSIC_ASSET, soundAssetForCue, type MusicAsset, type SoundAsset } from './soundAssets';

export type AudioCueType = 'button' | 'select' | 'invalid' | 'match' | 'combo' | 'win' | 'lose' | 'reward';

export interface AudioCue {
  type: AudioCueType;
  id: number;
  intensity?: number;
}

export interface SoundTone {
  type: OscillatorType;
  frequencyHz: number;
  glideToHz?: number;
  startMs: number;
  durationMs: number;
  gain: number;
}

export interface SynthAudioParam {
  setValueAtTime(value: number, startTime: number): void;
  linearRampToValueAtTime(value: number, endTime: number): void;
  exponentialRampToValueAtTime?(value: number, endTime: number): void;
}

export interface SynthOscillatorNode {
  type: OscillatorType;
  frequency: SynthAudioParam;
  connect(destination: unknown): void;
  start(startTime: number): void;
  stop(stopTime: number): void;
}

export interface SynthGainNode {
  gain: SynthAudioParam;
  connect(destination: unknown): void;
}

export interface SynthAudioContext {
  currentTime: number;
  state: string;
  destination: unknown;
  resume(): Promise<void>;
  createOscillator(): SynthOscillatorNode;
  createGain(): SynthGainNode;
}

type AudioContextFactory = () => SynthAudioContext | null;

export interface SoundAssetPlayer {
  preload(): void;
  play(volume: number): Promise<void>;
}

export interface MusicPlayer {
  play(volume: number): Promise<void>;
  pause(): void;
}

type SoundAssetPlayerFactory = (asset: SoundAsset) => SoundAssetPlayer | null;
type MusicPlayerFactory = (asset: MusicAsset) => MusicPlayer | null;

export interface SoundEngineOptions {
  createContext?: AudioContextFactory;
  createAssetPlayer?: SoundAssetPlayerFactory;
  createMusicPlayer?: MusicPlayerFactory;
}

const SOUND_PROFILES: Record<AudioCueType, SoundTone[]> = {
  button: [{ type: 'sine', frequencyHz: 420, glideToHz: 560, startMs: 0, durationMs: 54, gain: 0.035 }],
  select: [{ type: 'triangle', frequencyHz: 620, glideToHz: 760, startMs: 0, durationMs: 82, gain: 0.032 }],
  invalid: [
    { type: 'sawtooth', frequencyHz: 190, glideToHz: 128, startMs: 0, durationMs: 118, gain: 0.028 },
    { type: 'sine', frequencyHz: 118, startMs: 72, durationMs: 96, gain: 0.02 },
  ],
  match: [
    { type: 'triangle', frequencyHz: 520, glideToHz: 790, startMs: 0, durationMs: 118, gain: 0.044 },
    { type: 'sine', frequencyHz: 1040, glideToHz: 1240, startMs: 58, durationMs: 108, gain: 0.03 },
  ],
  combo: [
    { type: 'triangle', frequencyHz: 650, glideToHz: 980, startMs: 0, durationMs: 126, gain: 0.05 },
    { type: 'sine', frequencyHz: 1300, glideToHz: 1560, startMs: 74, durationMs: 132, gain: 0.036 },
  ],
  win: [
    { type: 'triangle', frequencyHz: 620, glideToHz: 760, startMs: 0, durationMs: 96, gain: 0.044 },
    { type: 'triangle', frequencyHz: 780, glideToHz: 980, startMs: 84, durationMs: 112, gain: 0.044 },
    { type: 'sine', frequencyHz: 1180, glideToHz: 1480, startMs: 174, durationMs: 150, gain: 0.036 },
  ],
  lose: [
    { type: 'triangle', frequencyHz: 260, glideToHz: 210, startMs: 0, durationMs: 128, gain: 0.034 },
    { type: 'sine', frequencyHz: 180, glideToHz: 145, startMs: 96, durationMs: 150, gain: 0.026 },
  ],
  reward: [
    { type: 'triangle', frequencyHz: 760, glideToHz: 1040, startMs: 0, durationMs: 104, gain: 0.04 },
    { type: 'sine', frequencyHz: 1520, startMs: 92, durationMs: 126, gain: 0.03 },
  ],
};

export function soundPlanForCue(cue: AudioCue): SoundTone[] {
  const profile = SOUND_PROFILES[cue.type];
  if (cue.type !== 'combo') {
    return profile.map((tone) => ({ ...tone }));
  }

  const multiplier = 1 + Math.min(5, Math.max(1, cue.intensity ?? 1)) * 0.035;
  return profile.map((tone) => ({
    ...tone,
    frequencyHz: tone.frequencyHz * multiplier,
    glideToHz: tone.glideToHz ? tone.glideToHz * multiplier : undefined,
  }));
}

export class SoundEngine {
  private context: SynthAudioContext | null = null;
  private lastCueId = 0;
  private readonly assetPlayers = new Map<AudioCueType, SoundAssetPlayer | null>();
  private musicPlayer: MusicPlayer | null | undefined;
  private musicPlaying = false;
  private musicPlayBlocked = false;
  private readonly createContext: AudioContextFactory;
  private readonly createAssetPlayer: SoundAssetPlayerFactory;
  private readonly createMusicPlayer: MusicPlayerFactory;

  constructor(options: SoundEngineOptions = {}) {
    this.createContext = options.createContext ?? createBrowserAudioContext;
    this.createAssetPlayer = options.createAssetPlayer ?? createBrowserAssetPlayer;
    this.createMusicPlayer = options.createMusicPlayer ?? createBrowserMusicPlayer;
  }

  preloadInitialAssets(): void {
    for (const type of INITIAL_SOUND_ASSET_TYPES) {
      this.assetPlayerFor(type)?.preload();
    }
  }

  async unlock(): Promise<boolean> {
    const context = this.ensureContext();
    this.musicPlayBlocked = false;
    if (!context) {
      return false;
    }
    if (context.state === 'suspended') {
      await context.resume();
    }

    return true;
  }

  async play(cue: AudioCue | null, enabled: boolean): Promise<boolean> {
    if (!cue || !enabled || cue.id === this.lastCueId) {
      return false;
    }

    const assetPlayed = await this.tryPlayAsset(cue);
    if (assetPlayed) {
      this.lastCueId = cue.id;
      return true;
    }

    const context = this.ensureContext();
    if (!context) {
      return false;
    }

    if (context.state === 'suspended') {
      await context.resume();
    }

    for (const tone of soundPlanForCue(cue)) {
      scheduleTone(context, tone);
    }
    this.lastCueId = cue.id;
    return true;
  }

  async syncMusic(enabled: boolean): Promise<boolean> {
    const player = this.musicPlayerFor();
    if (!player) {
      return false;
    }

    if (!enabled) {
      if (!this.musicPlaying) {
        this.musicPlayBlocked = false;
        return false;
      }

      player.pause();
      this.musicPlaying = false;
      this.musicPlayBlocked = false;
      return true;
    }

    if (this.musicPlaying || this.musicPlayBlocked) {
      return false;
    }

    try {
      await player.play(MUSIC_ASSET.volume);
      this.musicPlaying = true;
      return true;
    } catch {
      this.musicPlaying = false;
      this.musicPlayBlocked = true;
      return false;
    }
  }

  private ensureContext(): SynthAudioContext | null {
    if (!this.context) {
      this.context = this.createContext();
    }
    return this.context;
  }

  private assetPlayerFor(type: AudioCueType): SoundAssetPlayer | null {
    if (!this.assetPlayers.has(type)) {
      this.assetPlayers.set(type, this.createAssetPlayer(soundAssetForCue(type)));
    }
    return this.assetPlayers.get(type) ?? null;
  }

  private musicPlayerFor(): MusicPlayer | null {
    if (this.musicPlayer === undefined) {
      this.musicPlayer = this.createMusicPlayer(MUSIC_ASSET);
    }
    return this.musicPlayer;
  }

  private async tryPlayAsset(cue: AudioCue): Promise<boolean> {
    const asset = soundAssetForCue(cue.type);
    const player = this.assetPlayerFor(cue.type);
    if (!player) {
      return false;
    }

    try {
      await player.play(asset.volume);
      return true;
    } catch {
      return false;
    }
  }
}

function scheduleTone(context: SynthAudioContext, tone: SoundTone): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startTime = context.currentTime + tone.startMs / 1000;
  const endTime = startTime + tone.durationMs / 1000;

  oscillator.type = tone.type;
  oscillator.frequency.setValueAtTime(Math.max(1, tone.frequencyHz), startTime);
  if (tone.glideToHz) {
    oscillator.frequency.exponentialRampToValueAtTime?.(Math.max(1, tone.glideToHz), endTime);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(tone.gain, startTime + 0.012);
  gain.gain.linearRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.02);
}

function createBrowserAudioContext(): SynthAudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const browserWindow = window as Window & {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  const AudioContextCtor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
  return AudioContextCtor ? new AudioContextCtor() : null;
}

function createBrowserAssetPlayer(asset: SoundAsset): SoundAssetPlayer | null {
  if (typeof Audio === 'undefined') {
    return null;
  }

  return new BrowserSoundAssetPlayer(asset.src);
}

function createBrowserMusicPlayer(asset: MusicAsset): MusicPlayer | null {
  if (typeof Audio === 'undefined') {
    return null;
  }

  return new BrowserMusicPlayer(asset);
}

class BrowserSoundAssetPlayer implements SoundAssetPlayer {
  private readonly pool: HTMLAudioElement[];

  constructor(private readonly src: string) {
    this.pool = [this.createAudio(), this.createAudio(), this.createAudio()];
  }

  preload(): void {
    for (const audio of this.pool) {
      audio.load();
    }
  }

  async play(volume: number): Promise<void> {
    const audio = this.pool.find((candidate) => candidate.paused || candidate.ended) ?? this.createAudio();
    audio.currentTime = 0;
    audio.volume = volume;
    await audio.play();
  }

  private createAudio(): HTMLAudioElement {
    const audio = new Audio(this.src);
    audio.preload = 'auto';
    return audio;
  }
}

class BrowserMusicPlayer implements MusicPlayer {
  private readonly audio: HTMLAudioElement;

  constructor(asset: MusicAsset) {
    this.audio = new Audio(asset.src);
    this.audio.loop = asset.loop;
    this.audio.preload = 'auto';
  }

  async play(volume: number): Promise<void> {
    this.audio.volume = volume;
    await this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }
}
