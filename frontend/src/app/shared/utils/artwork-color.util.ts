const GROUND_LIGHTNESS = 8;
const MAX_SATURATION = 45;
const MIN_COLOUR_WEIGHT = 0.04;

export interface ArtworkHue {
  hue: number;
  saturation: number;
}

export function artworkHue(rgba: ArrayLike<number>): ArtworkHue | null {
  let x = 0;
  let y = 0;
  let satSum = 0;
  let weightSum = 0;
  let pixels = 0;

  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    pixels++;
    const r = rgba[i] / 255;
    const g = rgba[i + 1] / 255;
    const b = rgba[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) continue;
    const l = (max + min) / 2;
    const s = delta / (1 - Math.abs(2 * l - 1));
    const h =
      max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    const weight = s * (1 - Math.abs(2 * l - 1));
    const angle = (h / 6) * 2 * Math.PI;
    x += Math.cos(angle) * weight;
    y += Math.sin(angle) * weight;
    satSum += s * weight;
    weightSum += weight;
  }

  if (pixels === 0 || weightSum / pixels < MIN_COLOUR_WEIGHT) return null;
  return {
    hue: Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360),
    saturation: Math.round((satSum / weightSum) * 100),
  };
}

export function groundColor(tone: ArtworkHue | null): string | null {
  if (!tone) return null;
  const saturation = Math.round(Math.min(MAX_SATURATION, tone.saturation * 0.8));
  return `hsl(${tone.hue} ${saturation}% ${GROUND_LIGHTNESS}%)`;
}

export function artworkGroundColor(rgba: ArrayLike<number>): string | null {
  return groundColor(artworkHue(rgba));
}
