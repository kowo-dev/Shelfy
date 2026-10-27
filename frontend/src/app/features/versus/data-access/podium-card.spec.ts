import { vi } from 'vitest';
import type {
  VersusEntry,
  VersusPodiumEntry,
  VersusSessionResult,
} from '@app/core/services/versus/versus.model';
import { renderPodiumCard } from './podium-card';

const labels = { byline: 'Played by kowo', places: { 1: 'Winner', 2: 'Second', 3: 'Third' } };

const place = (n: number, title: string): VersusPodiumEntry => ({
  place: n,
  communityRank: null,
  entry: { id: String(n), title, coverUrl: null, media: null, clip: null } as VersusEntry,
});

const result = (podium: VersusPodiumEntry[], poolName = 'Best openings') =>
  ({ poolName, podium }) as VersusSessionResult;

describe('renderPodiumCard', () => {
  let texts: string[];
  let width: (text: string) => number;
  let toBlob: (callback: (blob: Blob | null) => void) => void;
  let canvas: { width: number; height: number };

  beforeEach(() => {
    texts = [];
    width = (text) => text.length * 10;
    toBlob = (callback) => callback(new Blob(['png']));
    const ctx = new Proxy(
      {
        fillText: (text: string) => texts.push(text),
        measureText: (text: string) => ({ width: width(text) }),
        createLinearGradient: () => ({ addColorStop: vi.fn() }),
      } as Record<string, unknown>,
      { get: (target, key: string) => target[key] ?? vi.fn(), set: () => true },
    );
    canvas = { width: 0, height: 0 };
    vi.spyOn(document, 'createElement').mockImplementation(
      () =>
        Object.assign(canvas, {
          getContext: () => ctx,
          toBlob: (callback: (blob: Blob | null) => void) => toBlob(callback),
        }) as unknown as HTMLCanvasElement,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('draws a 1200 by 630 share image and returns it as a PNG blob', async () => {
    const blob = await renderPodiumCard(result([place(1, 'A'), place(2, 'B')]), labels);

    expect(canvas).toMatchObject({ width: 1200, height: 630 });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('writes the pool, the winner and the runners-up', async () => {
    await renderPodiumCard(
      result([place(1, 'Alpha'), place(2, 'Beta'), place(3, 'Gamma')]),
      labels,
    );

    expect(texts).toEqual(
      expect.arrayContaining([
        'Best openings',
        'Played by kowo',
        'Winner',
        'Alpha',
        'Second · Beta',
        'Third · Gamma',
        'shelfy',
      ]),
    );
  });

  it('leaves out the places nobody took', async () => {
    await renderPodiumCard(result([place(1, 'Alpha')]), labels);

    expect(texts.some((text) => text.startsWith('Second'))).toBe(false);
    expect(texts.some((text) => text.startsWith('Third'))).toBe(false);
  });

  it('shortens a title that does not fit with an ellipsis', async () => {
    width = (text) => text.length * 20;

    await renderPodiumCard(result([place(1, 'A very long winning title that cannot fit')]), labels);

    const shortened = texts.find((text) => text.endsWith('…'));
    expect(shortened).toBeDefined();
    expect(shortened!.length).toBeLessThan('A very long winning title that cannot fit'.length);
  });

  it('fails when the canvas cannot be used', async () => {
    vi.spyOn(document, 'createElement').mockImplementation(
      () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
    );

    await expect(renderPodiumCard(result([]), labels)).rejects.toThrow('Canvas unavailable');
  });

  it('fails when the image cannot be exported', async () => {
    toBlob = (callback) => callback(null);

    await expect(renderPodiumCard(result([place(1, 'A')]), labels)).rejects.toThrow(
      'Export failed',
    );
  });
});
