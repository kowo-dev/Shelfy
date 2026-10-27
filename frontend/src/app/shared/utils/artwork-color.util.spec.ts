import { artworkGroundColor } from './artwork-color.util';

function pixels(...colors: [number, number, number, number?][]): number[] {
  return colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a]);
}

describe('artworkGroundColor', () => {
  it('takes the hue of a coloured artwork and keeps the ground dark', () => {
    expect(artworkGroundColor(pixels([30, 80, 220], [40, 90, 200]))).toMatch(
      /^hsl\(22\d \d+% 8%\)$/,
    );
  });

  it('caps the saturation so the tint stays calm', () => {
    const [, sat] = artworkGroundColor(pixels([255, 0, 0]))!.match(/ (\d+)%/)!;
    expect(Number(sat)).toBeLessThanOrEqual(45);
  });

  it('wraps red hues across 0°', () => {
    const hue = Number(
      artworkGroundColor(pixels([230, 20, 40], [230, 40, 20]))!.match(/hsl\((\d+)/)![1],
    );
    expect(hue < 10 || hue > 350).toBe(true);
  });

  it('returns null for greyscale, transparent or empty artwork', () => {
    expect(artworkGroundColor(pixels([20, 20, 20], [200, 200, 200]))).toBeNull();
    expect(artworkGroundColor(pixels([255, 0, 0, 0]))).toBeNull();
    expect(artworkGroundColor([])).toBeNull();
  });
});
