import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { RelatedMediaService } from '@app/core/services/related/related';
import type {
  RelatedEntity,
  RelatedMediaResponse,
  RelatedSection,
} from '@app/core/services/related/related.model';
import type { SearchResult } from '@app/core/services/search/search.model';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';

import { MediaDetailRelatedComponent } from './media-detail-related';

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    provider: 'tmdb',
    mediaType: 'movie',
    externalId: '2',
    title: 'Arrival',
    posterPath: '/arrival.jpg',
    overview: '',
    releaseYear: 2016,
    genres: [],
    voteAverage: 7.6,
    voteCount: 100,
    status: null,
    isInCollection: false,
    ...overrides,
  };
}

describe('MediaDetailRelatedComponent', () => {
  const getRelated = vi.fn();

  beforeEach(async () => {
    getRelated.mockReset();
    await TestBed.configureTestingModule({
      imports: [MediaDetailRelatedComponent],
      providers: [
        provideRouter([]),
        {
          provide: TranslateService,
          useValue: {
            get: (key: string, params?: Record<string, string>) =>
              params ? `${key}:${Object.values(params).join(',')}` : key,
            lang: () => 'en',
          },
        },
        { provide: RelatedMediaService, useValue: { getRelated } },
        { provide: TmdbService, useValue: { imageUrl: (path: string) => `tmdb:${path}` } },
        { provide: IgdbService, useValue: { imageUrl: (id: string) => `igdb:${id}` } },
      ],
    }).compileComponents();
  });

  function setup(sections: RelatedSection[]) {
    getRelated.mockReturnValue(of({ sections }));
    const fixture = TestBed.createComponent(MediaDetailRelatedComponent);
    fixture.componentRef.setInput('mediaType', 'movie');
    fixture.componentRef.setInput('externalId', 1);
    fixture.detectChanges();
    return fixture;
  }

  function headings(fixture: ReturnType<typeof setup>): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>).map(
      (h) => h.textContent?.trim() ?? '',
    );
  }

  it('holds the place of the rails with skeletons until the sections arrive', () => {
    const response = new Subject<RelatedMediaResponse>();
    getRelated.mockReturnValue(response);
    const fixture = TestBed.createComponent(MediaDetailRelatedComponent);
    fixture.componentRef.setInput('mediaType', 'movie');
    fixture.componentRef.setInput('externalId', 1);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('shelfy-rail-skeleton')).toHaveLength(1);

    response.next({
      sections: [{ kind: 'similar', label: null, entity: null, items: [result()], hasMore: false }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('shelfy-rail-skeleton')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('shelfy-shelf-section')).toHaveLength(1);
  });

  it('leaves no trace when there is nothing related', () => {
    const fixture = setup([]);

    expect(fixture.nativeElement.querySelector('shelfy-rail-skeleton')).toBeNull();
    expect(fixture.nativeElement.querySelector('shelfy-rail')).toBeNull();
  });

  it('loads the sections of the current media', () => {
    setup([]);
    expect(getRelated).toHaveBeenCalledWith('movie', 1);
  });

  it('titles each kind of section and links the tiles to their media page', () => {
    const fixture = setup([
      { kind: 'similar', label: null, entity: null, items: [result()], hasMore: true },
      {
        kind: 'franchise',
        label: 'Dune Collection',
        entity: null,
        items: [result()],
        hasMore: false,
      },
      {
        kind: 'entity',
        label: null,
        entity: { kind: 'people', id: '7', name: 'Denis', role: 'director' },
        items: [result()],
        hasMore: false,
      },
    ]);

    expect(headings(fixture)).toEqual([
      expect.stringContaining('media.related.similar'),
      expect.stringContaining('Dune Collection'),
      expect.stringContaining('media.related.directed_by:Denis'),
    ]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (fixture.nativeElement.querySelector('shelfy-media-card article') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/media', 'movie', '2']);
    expect(
      fixture.nativeElement.querySelector('shelfy-media-card img')?.getAttribute('src'),
    ).toContain('tmdb:/arrival.jpg');
  });

  it('titles entity rails after how the entity relates to the works', () => {
    const entity = (kind: RelatedEntity['kind'], name: string, role: string): RelatedSection => ({
      kind: 'entity',
      label: null,
      entity: { kind, id: name, name, role },
      items: [result()],
      hasMore: false,
    });
    const fixture = setup([
      entity('people', 'Villeneuve', 'director'),
      entity('staff', 'Morimi', 'creator'),
      entity('networks', 'AMC', 'network'),
      entity('studios', 'Wit', 'studio'),
    ]);

    expect(headings(fixture)).toEqual([
      'media.related.directed_by:Villeneuve',
      'media.related.works_and_adaptations:Morimi',
      'media.related.also_on:AMC',
      'media.related.more_from:Wit',
    ]);
  });

  it('links "view all" to the similar page and to the entity page', () => {
    const fixture = setup([
      { kind: 'similar', label: null, entity: null, items: [result()], hasMore: true },
      {
        kind: 'entity',
        label: null,
        entity: { kind: 'studios', id: '6', name: 'Wit', role: 'studio' },
        items: [result()],
        hasMore: false,
      },
    ]);

    const viewAll = Array.from(
      fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>,
    )
      .map((a) => a.getAttribute('href'))
      .filter((href) => !href?.startsWith('/media/movie/2'));
    expect(viewAll).toEqual(['/media/movie/1/similar', '/studios/6']);
  });

  it('links a franchise with a page of its own to it', () => {
    const fixture = setup([
      {
        kind: 'franchise',
        label: 'Zelda',
        entity: { kind: 'franchises', id: '5', name: 'Zelda', role: 'franchise' },
        items: [result({ provider: 'igdb', mediaType: 'game', posterPath: 'cover2' })],
        hasMore: false,
      },
    ]);

    expect(headings(fixture)).toEqual([expect.stringContaining('Zelda')]);
    expect(fixture.nativeElement.querySelector('.section-more')?.getAttribute('href')).toBe(
      '/franchises/5',
    );
    expect(
      fixture.nativeElement.querySelector('shelfy-media-card img')?.getAttribute('src'),
    ).toContain('igdb:cover2');
  });

  it('renders full cards that can be added to the shelf', () => {
    const fixture = setup([
      { kind: 'similar', label: null, entity: null, items: [result()], hasMore: false },
    ]);

    expect(
      fixture.nativeElement.querySelector(
        'shelfy-media-card [aria-label^="collection.backlog.add · "]',
      ),
    ).not.toBeNull();
  });
});
