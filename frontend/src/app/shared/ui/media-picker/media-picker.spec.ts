import { NEVER, of } from 'rxjs';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import { SearchService } from '@app/core/services/search/search';
import type { SearchResult } from '@app/core/services/search/search.model';
import { TranslateService } from '@app/core/services/translate/translate';

import { MediaPickerComponent } from './media-picker';

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    provider: 'tmdb',
    mediaType: 'movie',
    externalId: '1',
    title: 'Movie 1',
    posterPath: '/poster.jpg',
    overview: '',
    releaseYear: 2020,
    genres: [],
    voteAverage: null,
    voteCount: null,
    status: null,
    isInCollection: false,
    ...overrides,
  };
}

describe('MediaPickerComponent', () => {
  let searchService: { explore: ReturnType<typeof vi.fn> };
  let stored: Map<string, string>;
  let user: { id: string } | null;

  beforeEach(() => {
    stored = new Map();
    user = null;
  });

  function setup(open = true) {
    searchService = {
      explore: vi.fn().mockReturnValue(
        of({
          results: [result()],
          hasMore: false,
          page: 1,
          skippedTypes: [],
          unavailableProviders: [],
        }),
      ),
    };
    TestBed.configureTestingModule({
      imports: [MediaPickerComponent],
      providers: [
        {
          provide: SearchService,
          useValue: {
            ...searchService,
            vocabulary: () => NEVER,
            streaming: () => NEVER,
          },
        },
        { provide: CollectionService, useValue: { changes: NEVER, lookupBatch: () => of({}) } },
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: LocalStorageService,
          useValue: {
            getItem: (key: string) => stored.get(key) ?? null,
            setItem: (key: string, value: string) => stored.set(key, value),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MediaPickerComponent);
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
    return fixture;
  }

  it('explores as soon as it opens and not while closed', () => {
    const fixture = setup(false);
    expect(searchService.explore).not.toHaveBeenCalled();

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(searchService.explore).toHaveBeenCalled();
    expect(fixture.componentInstance.results.results().length).toBe(1);
  });

  it('explores only the picked type and remembers it', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    component.selectTypeTab('anime');
    TestBed.tick();

    expect(component.exploreQuery().type).toBe('anime');
    expect(stored.get('shelfy.media-picker.type')).toBe('anime');
  });

  it('starts on the remembered type', () => {
    stored.set('shelfy.media-picker.type', 'game');
    const fixture = setup();

    expect(fixture.componentInstance.exploreQuery().type).toBe('game');
  });

  it('pick() only queues a result and confirm() emits it', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const picked: SearchResult[] = [];
    component.picked.subscribe((r) => picked.push(r));

    component.pick(result());
    expect(picked).toEqual([]);
    expect(component.isChecked(result())).toBe(true);

    component.pick(result());
    expect(component.pending()).toEqual([]);

    component.pick(result());
    component.confirm();

    expect(picked).toEqual([result()]);
    expect(component.pending()).toEqual([]);
  });

  it('pick() emits unpicked instead of picked for an already-selected result', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('alreadySelected', [result()]);
    const picked: SearchResult[] = [];
    const unpicked: SearchResult[] = [];
    component.picked.subscribe((r) => picked.push(r));
    component.unpicked.subscribe((r) => unpicked.push(r));

    component.pick(result());

    expect(picked).toEqual([]);
    expect(unpicked).toEqual([result()]);
  });

  it('owned() reflects ownership from collectionSync', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    expect(component.owned(result())).toBe(false);

    component.collectionSync.collectionItemByKey.set({
      'tmdb:movie:1': { id: 'x', status: 'done' } as never,
    });
    expect(component.owned(result())).toBe(true);
  });

  it('counts years as one filter next to criteria', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    component.setYears({ from: 1990, to: 1999 });
    component.addCriterion({ token: 'action', label: null });

    expect(component.filterCount()).toBe(2);
  });

  it('closing the picker also closes its filters sheet', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    component.filtersOpen.set(true);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(component.filtersOpen()).toBe(false);
  });

  it('resets the query when the parent closes it', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    component.setText('batman');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(component.exploreQuery().text).toBe('');
  });

  it('onClosed() resets and emits closed', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    component.setText('batman');
    const closedEvents: void[] = [];
    component.closed.subscribe(() => closedEvents.push(undefined));

    component.onClosed();

    expect(component.exploreQuery().text).toBe('');
    expect(closedEvents.length).toBe(1);
  });

  it('hides shelved titles when signed in and "Hide mine" is on', () => {
    user = { id: 'me' };
    const fixture = setup();
    const component = fixture.componentInstance;
    component.collectionSync.collectionItemByKey.set({
      'tmdb:movie:1': { id: 'x', status: 'done' } as never,
    });

    expect(component.visibleResults().length).toBe(1);
    component.history.setHideOwned(true);
    expect(component.visibleResults()).toEqual([]);
  });
});
