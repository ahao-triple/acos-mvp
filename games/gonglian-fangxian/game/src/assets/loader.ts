export interface LoadedAssets {
  images: Map<string, HTMLImageElement>;
  audio: Map<string, HTMLAudioElement>;
  missing: string[];
}

export async function loadAssets(images: Record<string, string>, audio: Record<string, string>): Promise<LoadedAssets> {
  const loadedImages = new Map<string, HTMLImageElement>();
  const loadedAudio = new Map<string, HTMLAudioElement>();
  const missing: string[] = [];

  await Promise.all([
    ...Object.entries(images).map(async ([key, src]) => {
      const image = await loadImage(src);
      if (image) {
        loadedImages.set(key, image);
      } else {
        missing.push(src);
      }
    }),
    ...Object.entries(audio).map(async ([key, src]) => {
      const clip = await loadAudio(src);
      if (clip) {
        loadedAudio.set(key, clip);
      } else {
        missing.push(src);
      }
    }),
  ]);

  return { images: loadedImages, audio: loadedAudio, missing };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function loadAudio(src: string): Promise<HTMLAudioElement | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.oncanplaythrough = () => resolve(audio);
    audio.onerror = () => resolve(null);
    audio.src = src;
  });
}
