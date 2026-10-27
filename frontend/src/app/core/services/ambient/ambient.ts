import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { artworkHue, groundColor, type ArtworkHue } from '@shared/utils/artwork-color.util';
import { imageRendition } from '@shared/utils/image-rendition.util';

@Injectable({ providedIn: 'root' })
export class AmbientService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly cache = new Map<string, Promise<Uint8ClampedArray | null>>();
  private request = 0;
  private followed: string | null = null;

  get current(): string | null {
    return this.followed;
  }

  async follow(url: string | null): Promise<void> {
    const request = ++this.request;
    this.followed = url;
    const color = url ? await this.colorOf(url) : null;
    if (request !== this.request) return;
    if (color) this.root.style.setProperty('--ambient', color);
    else this.root.style.removeProperty('--ambient');
  }

  tint(tone: ArtworkHue | null): void {
    ++this.request;
    this.followed = null;
    const color = groundColor(tone);
    if (color) this.root.style.setProperty('--ambient', color);
    else this.root.style.removeProperty('--ambient');
  }

  colorOf(url: string): Promise<string | null> {
    return this.hueOf(url).then(groundColor);
  }

  brightnessOf(url: string): Promise<number | null> {
    return this.pixelsOf(url).then((pixels) => (pixels ? meanLuminance(pixels) : null));
  }

  private hueOf(url: string): Promise<ArtworkHue | null> {
    return this.pixelsOf(url).then((pixels) => (pixels ? artworkHue(pixels) : null));
  }

  private pixelsOf(url: string): Promise<Uint8ClampedArray | null> {
    url = imageRendition(url, 'small');
    let pending = this.cache.get(url);
    if (!pending) {
      pending = this.sample(url);
      this.cache.set(url, pending);
    }
    return pending;
  }

  private sample(url: string): Promise<Uint8ClampedArray | null> {
    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 24;
          canvas.height = 24;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context?.drawImage(image, 0, 0, 24, 24);
          resolve(context ? context.getImageData(0, 0, 24, 24).data : null);
        } catch {
          resolve(null);
        }
      };
      image.onerror = () => resolve(null);
      image.src = url + (url.includes('?') ? '&' : '?') + 'ambient';
    });
  }
}

function meanLuminance(pixels: Uint8ClampedArray): number {
  let total = 0;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    total +=
      (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) / 255;
    count++;
  }
  return count ? total / count : 0;
}
