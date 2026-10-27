import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AniListService } from '@app/core/services/anilist/anilist';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { createShelfBackdrop } from './collection-banner-state';
import { ShelfArtService } from '@app/core/services/shelf-art/shelf-art';

const HERO = 'https://cdn.akamai.steamstatic.com/steam/apps/620/library_hero.jpg';

function entry(
  id: string,
  mediaType: CollectionItemResponse['media']['mediaType'],
  metadata: Record<string, unknown> | null = null,
  coverUrl: string | null = `${id}-cover.jpg`,
): CollectionItemResponse {
  return {
    id: `item-${id}`,
    userId: 'u1',
    media: {
      id,
      canonicalWorkId: `c-${id}`,
      externalId: '42',
      provider: 'tmdb',
      mediaType,
      title: id,
      coverUrl,
      metadata,
      createdAt: '2024-01-01T00:00:00Z',
    },
    status: 'done',
    rating: null,
    note: null,
    containsSpoilers: false,
    progress: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('createShelfBackdrop', () => {
  let igdb: { getGame: ReturnType<typeof vi.fn>; imageUrl: ReturnType<typeof vi.fn> };
  let aniList: { getManga: ReturnType<typeof vi.fn>; getAnime: ReturnType<typeof vi.fn> };
  let heroExists: boolean;

  beforeEach(() => {
    heroExists = true;
    igdb = {
      getGame: vi.fn(() => of({ artworkImageIds: [], screenshotImageIds: [] })),
      imageUrl: vi.fn((id: string | null) => (id ? `https://igdb/t_1080p/${id}.jpg` : null)),
    };
    aniList = {
      getManga: vi.fn(() => of({ bannerImageUrl: null })),
      getAnime: vi.fn(() => of({ bannerImageUrl: null })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: IgdbService, useValue: igdb },
        { provide: AniListService, useValue: aniList },
      ],
    });
    vi.spyOn(TestBed.inject(ShelfArtService), 'imageExists').mockImplementation(
      async () => heroExists,
    );
  });

  function backdropFor(list: CollectionItemResponse[], random = () => 0) {
    const items = signal(list);
    const backdrop = TestBed.runInInjectionContext(() => createShelfBackdrop(items, random));
    return { items, backdrop };
  }

  async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }

  it('picks among items with art only and uses the stored backdrop first', () => {
    const { backdrop } = backdropFor(
      [
        entry('a', 'movie', { backdropUrl: 'https://img/a.jpg' }),
        entry('b', 'movie'),
        entry('c', 'movie', { backdropUrl: 'https://img/c.jpg' }),
      ],
      () => 0.9,
    );

    expect(backdrop()).toBe('https://img/c.jpg');
  });

  it('uses the Steam library hero for a game with a Steam app id', async () => {
    const { backdrop } = backdropFor([entry('g', 'game', { steamAppId: 620 })]);
    TestBed.tick();
    expect(backdrop()).toBeNull();

    await settle();

    expect(backdrop()).toBe(HERO);
    expect(igdb.getGame).not.toHaveBeenCalled();
  });

  it('falls back to the IGDB artwork when the Steam hero is missing, then to screenshots', async () => {
    heroExists = false;
    igdb.getGame.mockReturnValue(of({ artworkImageIds: ['art1'], screenshotImageIds: ['shot1'] }));
    const first = backdropFor([entry('g1', 'game', { steamAppId: 620 })]);
    TestBed.tick();
    await settle();
    expect(first.backdrop()).toBe('https://igdb/t_1080p/art1.jpg');

    igdb.getGame.mockReturnValue(of({ artworkImageIds: [], screenshotImageIds: ['shot2'] }));
    const second = backdropFor([entry('g2', 'game')]);
    TestBed.tick();
    await settle();
    expect(second.backdrop()).toBe('https://igdb/t_1080p/shot2.jpg');
  });

  it('uses the AniList banner for a webtoon', async () => {
    aniList.getManga.mockReturnValue(of({ bannerImageUrl: 'https://anilist/banner.jpg' }));
    const { backdrop } = backdropFor([entry('w', 'webtoon')]);
    TestBed.tick();
    await settle();

    expect(backdrop()).toBe('https://anilist/banner.jpg');
    expect(aniList.getManga).toHaveBeenCalledWith(42);
  });

  it('tries the next title when the picked one has no banner', async () => {
    aniList.getManga.mockImplementation((id: number) =>
      of({ bannerImageUrl: id === 7 ? 'https://anilist/banner-7.jpg' : null }),
    );
    const withBanner = entry('w2', 'webtoon');
    withBanner.media.externalId = '7';
    const { backdrop } = backdropFor([entry('w1', 'webtoon'), withBanner]);
    TestBed.tick();
    await settle();

    expect(backdrop()).toBe('https://anilist/banner-7.jpg');
  });

  it('falls back to the cover when nothing is found or the lookup fails', async () => {
    const empty = backdropFor([entry('w', 'webtoon')]);
    TestBed.tick();
    await settle();
    expect(empty.backdrop()).toBe('w-cover.jpg');

    igdb.getGame.mockReturnValue(throwError(() => new Error('boom')));
    const failing = backdropFor([entry('g', 'game')]);
    TestBed.tick();
    await settle();
    expect(failing.backdrop()).toBe('g-cover.jpg');
  });

  it('looks each title up once per session', async () => {
    aniList.getManga.mockReturnValue(of({ bannerImageUrl: 'https://anilist/banner.jpg' }));
    const list = [entry('w', 'webtoon')];
    const first = backdropFor(list);
    TestBed.tick();
    await settle();
    const second = backdropFor(list);
    TestBed.tick();
    await settle();

    expect(first.backdrop()).toBe(second.backdrop());
    expect(aniList.getManga).toHaveBeenCalledTimes(1);
  });

  it('keeps its pick while it stays on the shelf, and falls back to a cover without any art', () => {
    const { items, backdrop } = backdropFor(
      [
        entry('a', 'movie', { backdropUrl: 'https://img/a.jpg' }),
        entry('b', 'movie', { backdropUrl: 'https://img/b.jpg' }),
      ],
      () => 0.9,
    );
    expect(backdrop()).toBe('https://img/b.jpg');

    items.set([
      entry('a', 'movie', { backdropUrl: 'https://img/a.jpg' }),
      entry('b', 'movie', { backdropUrl: 'https://img/b.jpg' }),
      entry('c', 'movie', { backdropUrl: 'https://img/c.jpg' }),
    ]);
    expect(backdrop()).toBe('https://img/b.jpg');

    items.set([entry('x', 'movie')]);
    expect(backdrop()).toBe('x-cover.jpg');

    items.set([]);
    expect(backdrop()).toBeNull();
  });
});
