export class ImageCache {
  private readonly images = new Map<string, HTMLImageElement>();

  get(src: string): HTMLImageElement | null {
    if (typeof Image === 'undefined') {
      return null;
    }
    const existing = this.images.get(src);
    if (existing) {
      return existing;
    }
    const image = new Image();
    image.src = src;
    this.images.set(src, image);
    return image;
  }
}
