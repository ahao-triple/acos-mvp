import type { AudioCueType } from './soundEngine';

export type SoundAssetPreload = 'initial' | 'lazy';

export interface SoundAsset {
  type: AudioCueType;
  src: string;
  preload: SoundAssetPreload;
  volume: number;
}

export interface MusicAsset {
  src: string;
  volume: number;
  loop: boolean;
}

export const SOUND_ASSET_BUDGET_BYTES = 900_000;

// 资源路径**一律用相对路径**（不带前导斜杠），见 docs/vivo-quirks.md "资源加载 - 前导斜杠"段：
// vivo runtime 把 '/audio/x.wav' 解析成 https://<domain>/audio/x.wav 网络请求会 404；
// 'audio/x.wav' 则被当成本地 rpk 包内资源直接命中。浏览器对两种路径都能解析正确。
export const SOUND_ASSETS: Record<AudioCueType, SoundAsset> = {
  button: { type: 'button', src: 'audio/button.wav', preload: 'initial', volume: 0.46 },
  select: { type: 'select', src: 'audio/select.wav', preload: 'initial', volume: 0.5 },
  invalid: { type: 'invalid', src: 'audio/invalid.wav', preload: 'initial', volume: 0.5 },
  match: { type: 'match', src: 'audio/match.wav', preload: 'initial', volume: 0.54 },
  combo: { type: 'combo', src: 'audio/combo.wav', preload: 'lazy', volume: 0.58 },
  reward: { type: 'reward', src: 'audio/reward.wav', preload: 'lazy', volume: 0.54 },
  win: { type: 'win', src: 'audio/win.wav', preload: 'lazy', volume: 0.56 },
  lose: { type: 'lose', src: 'audio/lose.wav', preload: 'lazy', volume: 0.5 },
};

export const INITIAL_SOUND_ASSET_TYPES: AudioCueType[] = ['button', 'select', 'invalid', 'match'];

export const MUSIC_ASSET: MusicAsset = {
  src: 'audio/bgm.mp3',
  volume: 0.22,
  loop: true,
};

export function soundAssetForCue(type: AudioCueType): SoundAsset {
  return SOUND_ASSETS[type];
}
