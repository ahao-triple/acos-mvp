import type { PlatformAdapter } from './types';

export function createWebPlatformAdapter(): PlatformAdapter {
  let music: HTMLAudioElement | null = null;

  return {
    name: 'web',
    storage: {
      getItem(key) {
        return globalThis.localStorage?.getItem(key) ?? null;
      },
      setItem(key, value) {
        globalThis.localStorage?.setItem(key, value);
      },
      removeItem(key) {
        globalThis.localStorage?.removeItem(key);
      },
    },
    async login() {
      return { platform: 'web', code: 'web-dev' };
    },
    async request(options) {
      const response = await fetch(options.url, {
        method: options.method ?? 'GET',
        headers: options.headers,
        body: options.data === undefined ? undefined : JSON.stringify(options.data),
      });
      return {
        status: response.status,
        data: await response.json().catch(() => null),
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
    triggerHaptic() {
      // Browsers do not expose a consistent short haptic API.
    },
    async playSfx(name) {
      await playAudio(`/audio/${name}.wav`, false);
    },
    async playMusic(name, loop) {
      stopAudio(music);
      music = createAudio(`/audio/${name}.mp3`, loop);
      await music.play();
    },
    stopMusic() {
      stopAudio(music);
      music = null;
    },
    async showRewardedAd() {
      return { status: 'success' };
    },
  };
}

function createAudio(src: string, loop: boolean): HTMLAudioElement {
  const audio = new Audio();
  audio.src = src;
  audio.preload = 'auto';
  audio.loop = loop;
  audio.currentTime = 0;
  return audio;
}

async function playAudio(src: string, loop: boolean): Promise<void> {
  const audio = createAudio(src, loop);
  await safePlay(audio);
}

async function safePlay(audio: HTMLAudioElement): Promise<void> {
  try {
    await audio.play();
  } catch {
    // Autoplay policies may reject in previews; ignore and keep the game running.
  }
}

function stopAudio(audio: HTMLAudioElement | null): void {
  if (!audio) {
    return;
  }
  audio.pause();
  audio.currentTime = 0;
}
