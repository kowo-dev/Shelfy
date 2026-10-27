import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
  ExploreCatalogService,
  type ExploreSuggestion,
} from '@app/core/services/search/explore-catalog';
import {
  EMPTY_EXPLORE_QUERY,
  MAX_EXPLORE_CRITERIA,
  type ExploreCriterion,
  type ExploreQuery,
} from '@app/core/services/search/explore-query';
import { SearchService } from '@app/core/services/search/search';
import type { ExploreOption } from '@app/core/services/search/search.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { ExploreOmniboxComponent } from './explore-omnibox';

const crit = (token: string): ExploreCriterion => ({ token, label: null });
const drama: ExploreSuggestion = {
  kind: 'criterion',
  criterion: crit('drama'),
  label: 'Drama',
  group: 'genre',
};
const movies: ExploreSuggestion = { kind: 'category', type: 'movie', label: 'Movies' };

describe('ExploreOmniboxComponent', () => {
  let fixture: ComponentFixture<ExploreOmniboxComponent>;
  let suggest: ReturnType<typeof vi.fn>;
  let catalogOptions: ReturnType<typeof vi.fn>;

  function render(
    query: Partial<ExploreQuery> = {},
    suggestions: ExploreSuggestion[] = [drama, movies],
  ) {
    suggest = vi.fn().mockReturnValue(suggestions);
    catalogOptions = vi.fn().mockReturnValue(of([] as ExploreOption[]));
    TestBed.configureTestingModule({
      imports: [ExploreOmniboxComponent],
      providers: [
        {
          provide: ExploreCatalogService,
          useValue: { suggest, label: (c: ExploreCriterion) => c.token },
        },
        { provide: SearchService, useValue: { catalogOptions } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    fixture = TestBed.createComponent(ExploreOmniboxComponent);
    fixture.componentRef.setInput('query', { ...EMPTY_EXPLORE_QUERY, ...query });
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const type = (omnibox: ExploreOmniboxComponent, text: string) => {
    omnibox.onInput({ target: { value: text } } as unknown as Event);
    fixture.detectChanges();
  };
  const key = (name: string) => {
    const event = new KeyboardEvent('keydown', { key: name, cancelable: true });
    return event;
  };

  it('offers nothing until the user types', () => {
    const omnibox = render();

    expect(omnibox.options()).toEqual([]);
    expect(omnibox.expanded()).toBe(false);
  });

  it('lists suggestions then the plain text search, and opens the list', () => {
    const omnibox = render();

    type(omnibox, 'dra');

    expect(omnibox.options().map((o) => o.kind)).toEqual(['suggestion', 'suggestion', 'text']);
    expect(omnibox.expanded()).toBe(true);
  });

  it('hides a criterion that is already in the query but keeps categories', () => {
    const omnibox = render({ with: [crit('drama')] });

    type(omnibox, 'dra');

    expect(omnibox.suggestions()).toEqual([movies]);
  });

  it('cuts the text to 120 characters', () => {
    const omnibox = render();

    type(omnibox, 'a'.repeat(200));

    expect(omnibox.draft()).toHaveLength(120);
  });

  it('moves through the options with the arrows and wraps around', () => {
    const omnibox = render();
    type(omnibox, 'dra');

    omnibox.onKeydown(key('ArrowDown'));
    expect(omnibox.activeIndex()).toBe(0);
    omnibox.onKeydown(key('ArrowUp'));
    expect(omnibox.activeIndex()).toBe(2);
    omnibox.onKeydown(key('ArrowDown'));
    expect(omnibox.activeIndex()).toBe(0);
    expect(omnibox.activeId()).toBe('explore-suggestion-0');
  });

  it('adds the highlighted criterion on Enter and clears the field', () => {
    const omnibox = render();
    const added = vi.fn();
    omnibox.added.subscribe(added);
    type(omnibox, 'dra');

    omnibox.onKeydown(key('ArrowDown'));
    omnibox.onKeydown(key('Enter'));

    expect(added).toHaveBeenCalledWith(crit('drama'));
    expect(omnibox.draft()).toBe('');
    expect(omnibox.expanded()).toBe(false);
  });

  it('applies the typed text as a search when nothing is highlighted', () => {
    const omnibox = render();
    const text = vi.fn();
    omnibox.textChanged.subscribe(text);
    type(omnibox, '  dune ');

    omnibox.onKeydown(key('Enter'));

    expect(text).toHaveBeenCalledWith('dune');
  });

  it('picks a media type from a category suggestion without adding a criterion', () => {
    const omnibox = render();
    const picked = vi.fn();
    const added = vi.fn();
    omnibox.typePicked.subscribe(picked);
    omnibox.added.subscribe(added);
    type(omnibox, 'mov');

    omnibox.activate(omnibox.options()[1]);

    expect(picked).toHaveBeenCalledWith('movie');
    expect(added).not.toHaveBeenCalled();
  });

  it('refuses a new criterion once the query is full', () => {
    const full = Array.from({ length: MAX_EXPLORE_CRITERIA }, (_, i) => crit(`c${i}`));
    const omnibox = render({ with: full });
    const added = vi.fn();
    omnibox.added.subscribe(added);
    type(omnibox, 'dra');

    omnibox.activate(omnibox.options()[0]);

    expect(omnibox.full()).toBe(true);
    expect(added).not.toHaveBeenCalled();
  });

  it('closes the list on Escape only while it is open', () => {
    const omnibox = render();
    type(omnibox, 'dra');
    const open = key('Escape');
    omnibox.onKeydown(open);
    expect(omnibox.open()).toBe(false);
    expect(open.defaultPrevented).toBe(true);

    const closed = key('Escape');
    omnibox.onKeydown(closed);
    expect(closed.defaultPrevented).toBe(false);
  });

  it('removes the last chip, then the text, on Backspace in an empty field', () => {
    const omnibox = render({ with: [crit('a')], without: [crit('b')], text: 'dune' });
    const removed = vi.fn();
    const text = vi.fn();
    omnibox.removed.subscribe(removed);
    omnibox.textChanged.subscribe(text);

    omnibox.onKeydown(key('Backspace'));
    expect(removed).toHaveBeenCalledWith({ criterion: crit('b'), excluded: true });
    TestBed.resetTestingModule();

    const onlyText = render({ text: 'dune' });
    onlyText.textChanged.subscribe(text);
    onlyText.onKeydown(key('Backspace'));
    expect(text).toHaveBeenCalledWith('');
  });

  it('labels an excluded chip with the without prefix', () => {
    const omnibox = render();

    expect(omnibox.chipLabel({ criterion: crit('horror'), excluded: true })).toBe(
      'explore.without horror',
    );
    expect(omnibox.chipLabel({ criterion: crit('drama'), excluded: false })).toBe('drama');
  });

  it('asks the catalog for more options only for a typed query on a chosen type', async () => {
    vi.useFakeTimers();
    const omnibox = render({ type: 'movie' });
    type(omnibox, 'd');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(300);
    expect(catalogOptions).not.toHaveBeenCalled();

    type(omnibox, 'dune');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(300);

    expect(catalogOptions).toHaveBeenCalledWith('movie', 'dune');
    vi.useRealTimers();
  });

  it('closes the list when focus leaves the whole box', () => {
    const omnibox = render();
    type(omnibox, 'dra');
    const inside = document.createElement('div');
    const box = document.createElement('div');
    box.appendChild(inside);

    omnibox.onFocusOut({ relatedTarget: inside, currentTarget: box } as unknown as FocusEvent);
    expect(omnibox.open()).toBe(true);

    omnibox.onFocusOut({ relatedTarget: null, currentTarget: box } as unknown as FocusEvent);
    expect(omnibox.open()).toBe(false);
  });

  describe('without chips', () => {
    function renderPlain(query: Partial<ExploreQuery> = {}) {
      const omnibox = render(query);
      fixture.componentRef.setInput('showChips', false);
      fixture.detectChanges();
      return omnibox;
    }

    it('shows the searched text in the field', () => {
      const omnibox = renderPlain({ text: 'dune' });

      expect(omnibox.draft()).toBe('dune');
      expect(fixture.nativeElement.querySelector('input').value).toBe('dune');
      expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
    });

    it('keeps the typed text once applied and clears the search when the field is emptied', () => {
      const omnibox = renderPlain({ text: 'dune' });
      const emitted = vi.fn();
      omnibox.textChanged.subscribe(emitted);

      type(omnibox, 'dune messiah');
      omnibox.onKeydown(key('Enter'));
      expect(emitted).toHaveBeenLastCalledWith('dune messiah');
      expect(omnibox.draft()).toBe('dune messiah');

      type(omnibox, '');
      expect(emitted).toHaveBeenLastCalledWith('');
    });
  });
});
