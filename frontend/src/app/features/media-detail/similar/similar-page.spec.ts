import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { RelatedMediaService } from '@app/core/services/related/related';
import type { SimilarMediaResponse } from '@app/core/services/related/related.model';
import type { SearchResult } from '@app/core/services/search/search.model';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { SimilarPageComponent } from './similar-page';

function result(externalId: string): SearchResult {
  return {
    provider: 'tmdb',
    mediaType: 'movie',
    externalId,
    title: `Title ${externalId}`,
    posterPath: null,
    overview: '',
    releaseYear: null,
    genres: [],
    voteAverage: 7,
    voteCount: null,
    status: null,
    isInCollection: false,
  };
}

const page = (ids: string[], hasMore = false): SimilarMediaResponse => ({
  results: ids.map(result),
  page: 1,
  hasMore,
});

describe('SimilarPageComponent', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let getSimilar: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  async function setup(first = of(page(['1', '2'], true))) {
    params = new BehaviorSubject(convertToParamMap({ mediaType: 'movie', externalId: '603' }));
    getSimilar = vi.fn().mockReturnValue(first);
    navigate = vi.fn();
    TestBed.overrideComponent(SimilarPageComponent, { set: { template: '', imports: [] } });
    TestBed.configureTestingModule({
      imports: [SimilarPageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: Router, useValue: { navigate } },
        { provide: RelatedMediaService, useValue: { getSimilar } },
        { provide: TmdbService, useValue: { imageUrl: (p: string | null) => p } },
        { provide: IgdbService, useValue: { imageUrl: (p: string | null) => p } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(SimilarPageComponent);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('loads the first page for the title in the URL', async () => {
    const similar = await setup();

    expect(getSimilar).toHaveBeenCalledWith('movie', '603', 1);
    expect(similar.items().map((item) => item.externalId)).toEqual(['1', '2']);
    expect(similar.hasMore()).toBe(true);
    expect(similar.loading()).toBe(false);
    expect(similar.cardItems()).toHaveLength(2);
  });

  it('counts the loaded titles for the hero, with a plus while more can load', async () => {
    const similar = await setup();

    expect(similar.facts()).toEqual([{ value: '2+', label: 'entity.title_many' }]);
  });

  it('does not ask for a next page while one is loading or when there is none', async () => {
    const similar = await setup();
    getSimilar.mockReturnValue(new Subject());

    similar.loadMore();
    similar.loadMore();

    expect(getSimilar).toHaveBeenCalledTimes(2);
  });

  it('appends the next page without repeating a title', async () => {
    const similar = await setup();
    getSimilar.mockReturnValue(of(page(['2', '3'])));

    similar.loadMore();

    expect(getSimilar).toHaveBeenLastCalledWith('movie', '603', 2);
    expect(similar.items().map((item) => item.externalId)).toEqual(['1', '2', '3']);
    expect(similar.hasMore()).toBe(false);
  });

  it('reports a failure and lets the user retry', async () => {
    const similar = await setup(throwError(() => new Error('boom')));
    expect(similar.failed()).toBe(true);
    expect(similar.hasMore()).toBe(false);

    getSimilar.mockReturnValue(of(page(['1'])));
    similar.retry();

    expect(similar.failed()).toBe(false);
    expect(similar.items()).toHaveLength(1);
  });

  it('starts over when the title in the URL changes', async () => {
    const similar = await setup();

    params.next(convertToParamMap({ mediaType: 'anime', externalId: '21' }));
    TestBed.tick();

    expect(getSimilar).toHaveBeenLastCalledWith('anime', '21', 1);
    expect(similar.items().map((item) => item.externalId)).toEqual(['1', '2']);
  });

  it('ignores a slow answer for a title the user already left', async () => {
    const slow = new Subject<SimilarMediaResponse>();
    const similar = await setup(slow as never);
    getSimilar.mockReturnValue(of(page(['9'])));

    params.next(convertToParamMap({ mediaType: 'movie', externalId: '11' }));
    TestBed.tick();
    slow.next(page(['1']));

    expect(similar.items().map((item) => item.externalId)).toEqual(['9']);
  });

  it('opens the page of a chosen title', async () => {
    const similar = await setup();

    similar.goToMedia({ media: { mediaType: 'movie', externalId: '5' } } as CollectionItemResponse);

    expect(navigate).toHaveBeenCalledWith(['/media', 'movie', '5']);
  });
});
