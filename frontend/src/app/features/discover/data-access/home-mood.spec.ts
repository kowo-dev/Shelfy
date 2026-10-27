import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { SearchService } from '@app/core/services/search/search';
import { createHomeMood, moodGenre, weekIndex } from './home-mood';

const result = (id: number) => ({
  provider: 'tmdb',
  mediaType: 'movie',
  externalId: String(id),
  title: `Film ${id}`,
  posterPath: `https://img/p${id}.jpg`,
  overview: '',
  releaseYear: 2020,
  genres: [],
  voteAverage: 7,
  voteCount: 10,
  status: null,
  isInCollection: false,
});

describe('moodGenre', () => {
  it('changes every Monday and stays put during the week', () => {
    const monday = new Date(2026, 9, 26);
    const sunday = new Date(2026, 10, 1);
    const nextMonday = new Date(2026, 10, 2);

    expect(weekIndex(sunday)).toBe(weekIndex(monday));
    expect(weekIndex(nextMonday)).toBe(weekIndex(monday) + 1);
    expect(moodGenre('anime', nextMonday)).not.toBe(moodGenre('anime', monday));
  });
});

describe('createHomeMood', () => {
  const now = new Date(2026, 9, 25);
  let explore: ReturnType<typeof vi.fn>;

  function create(art: (item: CollectionItemResponse) => unknown) {
    return TestBed.runInInjectionContext(() =>
      createHomeMood({
        search: { explore } as unknown as SearchService,
        art: art as never,
        region: () => 'FR',
        now: () => now,
      }),
    );
  }

  it('explores the genre of the week and opens with the first title that has artwork', () => {
    explore = vi.fn(() => of({ results: [1, 2, 3, 4, 5, 6, 7].map(result) }));
    const art = { full: 'f', wide: 'w', card: 'c', thumb: 't' };
    const mood = create((item) => of(item.media.externalId === '2' ? art : null));

    mood.select('all');
    const entry = mood.mood()!;

    expect(explore).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'movie',
        with: [{ token: moodGenre('all', now), label: null }],
      }),
      1,
      'FR',
    );
    expect(entry.filter).toBe('all');
    expect(entry.mood?.hero?.media.title).toBe('Film 2');
    expect(entry.mood?.art).toBe(art);
    expect(entry.mood?.items.map((item) => item.media.title)).toEqual([
      'Film 1',
      'Film 3',
      'Film 4',
      'Film 5',
      'Film 6',
    ]);
    expect(entry.mood?.more).toEqual(expect.objectContaining({ type: 'movie' }));
  });

  it('falls back to a cover wall without artwork and skips thin results', () => {
    explore = vi.fn(() => of({ results: [1, 2, 3, 4, 5].map(result) }));
    const mood = create(() => of(null));

    mood.select('manga');
    expect(mood.mood()!.mood?.hero).toBeNull();
    expect(mood.mood()!.mood?.wall).toHaveLength(24);

    explore = vi.fn(() => of({ results: [1, 2].map(result) }));
    const thin = create(() => of(null));
    thin.select('anime');
    expect(thin.mood()).toEqual({ filter: 'anime', mood: null });
  });
});
