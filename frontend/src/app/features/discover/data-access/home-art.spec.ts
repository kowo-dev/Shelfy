import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { VISUALS_KEY, createHomeArt, resolveArt, type HomeArtResolver } from './home-art';

const item = (provider: string, mediaType: string, metadata: Record<string, unknown> = {}) =>
  ({
    media: { provider, mediaType, externalId: '7', title: 'T', coverUrl: 'c', metadata },
  }) as unknown as CollectionItemResponse;

function setup() {
  const tmdb = {
    getMovie: vi.fn(() => of({ backdropImagePaths: ['/bright.jpg', '/dark.jpg'] })),
    getTvShow: vi.fn(() => of({ backdropImagePaths: [] })),
    imageUrl: (path: string, size: string) => `${size}${path}`,
  };
  const igdb = {
    getGame: vi.fn(() => of({ artworkImageIds: ['art1'], screenshotImageIds: ['shot1'] })),
    imageUrl: (id: string, size: string) => `${size}/${id}`,
  };
  const brightness = vi.fn((url: string) => Promise.resolve(url.includes('bright') ? 0.8 : 0.3));
  const resolve = createHomeArt({
    tmdb: tmdb as unknown as TmdbService,
    igdb: igdb as unknown as IgdbService,
    brightness,
  });
  return { tmdb, igdb, resolve };
}

describe('createHomeArt', () => {
  it('picks the first textless backdrop that is not too bright', async () => {
    const { resolve } = setup();
    const art = await firstValueFrom(resolve(item('tmdb', 'movie')));

    expect(art).toEqual({
      full: 'original/dark.jpg',
      wide: 'w1280/dark.jpg',
      card: 'w780/dark.jpg',
      thumb: 'w300/dark.jpg',
    });
  });

  it('has no artwork without a textless backdrop or for cover-only media', async () => {
    const { resolve } = setup();
    expect(await firstValueFrom(resolve(item('tmdb', 'tv_show')))).toBeNull();
    expect(await firstValueFrom(resolve(item('anilist', 'anime')))).toBeNull();
    expect(
      await firstValueFrom(resolve(item('anilist', 'anime', { backdropUrl: 'c' }))),
    ).toBeNull();
  });

  it('uses the AniList banner as it is, however bright', async () => {
    const { resolve } = setup();

    expect(
      await firstValueFrom(resolve(item('anilist', 'manga', { backdropUrl: 'bright.jpg' }))),
    ).toEqual({ full: 'bright.jpg', wide: 'bright.jpg', card: 'bright.jpg', thumb: 'bright.jpg' });
  });

  it('prefers game screenshots over artworks, like the media visuals', async () => {
    const { resolve } = setup();

    expect((await firstValueFrom(resolve(item('igdb', 'game'))))?.full).toBe('t_1080p/shot1');
  });

  it('uses known game artworks before asking for the game', async () => {
    const { resolve, igdb } = setup();
    const known = await firstValueFrom(resolve(item('igdb', 'game', { [VISUALS_KEY]: ['art1'] })));

    expect(known?.full).toBe('t_1080p/art1');
    expect(igdb.getGame).not.toHaveBeenCalled();
  });

  it('caches each title', async () => {
    const { resolve, tmdb } = setup();
    await firstValueFrom(resolve(item('tmdb', 'movie')));
    await firstValueFrom(resolve(item('tmdb', 'movie')));

    expect(tmdb.getMovie).toHaveBeenCalledTimes(1);
  });
});

describe('resolveArt', () => {
  const titles = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => item('tmdb', id));
  const framedExcept = (...bare: string[]) =>
    vi.fn<HomeArtResolver>((value) =>
      of(
        bare.includes(value.media.mediaType)
          ? null
          : { full: 'f', wide: 'w', card: 'c', thumb: 't' },
      ),
    );

  it('stops after the first batch when it is fully framed', async () => {
    const resolve = framedExcept();
    const resolved = await firstValueFrom(resolveArt(resolve, titles, 3));

    expect(resolved.map((entry) => entry.item.media.mediaType)).toEqual(['a', 'b', 'c']);
    expect(resolve).toHaveBeenCalledTimes(3);
  });

  it('resolves further batches until enough titles have art', async () => {
    const resolve = framedExcept('b', 'c');
    const resolved = await firstValueFrom(resolveArt(resolve, titles, 3));

    expect(
      resolved.filter((entry) => entry.art).map((entry) => entry.item.media.mediaType),
    ).toEqual(['a', 'd', 'e', 'f']);
    expect(resolve).toHaveBeenCalledTimes(6);
  });

  it('uses its own batch size and returns everything when art runs out', async () => {
    const resolve = framedExcept('a', 'b', 'c', 'd', 'e', 'f', 'g');
    const resolved = await firstValueFrom(resolveArt(resolve, titles, 1, 2));

    expect(resolved).toHaveLength(7);
    expect(resolved.every((entry) => entry.art === null)).toBe(true);
  });
});
