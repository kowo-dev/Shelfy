import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AmbientService } from '@app/core/services/ambient/ambient';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { TranslateService } from '@app/core/services/translate/translate';
import type { HomeSlide } from '../../data-access/home-discovery';

import { HomeStageComponent } from './home-stage';

const slide = (id: string, art = true): HomeSlide => ({
  item: {
    id,
    status: 'planned',
    rating: 8,
    media: {
      id,
      provider: 'tmdb',
      mediaType: 'movie',
      externalId: id,
      title: `Title ${id}`,
      coverUrl: `${id}.jpg`,
      metadata: { releaseDate: '2026-04-01', overview: `Story of ${id}` },
    },
  } as unknown as CollectionItemResponse,
  art: art
    ? { full: `full-${id}`, wide: `wide-${id}`, card: `card-${id}`, thumb: `thumb-${id}` }
    : null,
});

describe('HomeStageComponent', () => {
  let owned: CollectionItemResponse | null;

  beforeEach(() => {
    owned = null;
    TestBed.configureTestingModule({
      imports: [HomeStageComponent],
      providers: [
        provideRouter([]),
        { provide: ShelfLookupService, useValue: { find: () => owned, request: vi.fn() } },
        { provide: AmbientService, useValue: { colorOf: () => Promise.resolve('#123') } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
  });

  function render(value: HomeSlide) {
    const fixture = TestBed.createComponent(HomeStageComponent);
    fixture.componentRef.setInput('slide', value);
    fixture.componentRef.setInput('kicker', 'Trending this week');
    fixture.detectChanges();
    return fixture;
  }

  const text = (fixture: ReturnType<typeof render>) =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('features one title with its type, year, rating and story', () => {
    const fixture = render(slide('a'));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('#home-stage-title')?.textContent?.trim()).toBe('Title a');
    expect(el.querySelector('.meta-line')?.textContent?.replace(/\s+/g, '')).toContain(
      'collection.media_type_one.movie·2026',
    );
    expect(text(fixture)).toContain('Story of a');
    expect(el.querySelector('img[sizes]')?.getAttribute('src')).toBe('wide-a');
    expect(el.querySelectorAll('button')).toHaveLength(2);
  });

  it('moves the carousel to a side poster, by click and by arrow key', () => {
    const fixture = TestBed.createComponent(HomeStageComponent);
    fixture.componentRef.setInput('slide', slide('b'));
    fixture.componentRef.setInput('slides', [slide('a'), slide('b'), slide('c')]);
    fixture.componentRef.setInput('kicker', 'Trending this week');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const title = () => el.querySelector('#home-stage-title')?.textContent?.trim();

    expect(title()).toBe('Title b');
    fixture.componentInstance.pick(2);
    fixture.detectChanges();
    expect(title()).toBe('Title c');

    fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(title()).toBe('Title a');
  });

  it('slides the picked poster to the centre without reshuffling the deck', () => {
    const fixture = TestBed.createComponent(HomeStageComponent);
    fixture.componentRef.setInput('slide', slide('a'));
    fixture.componentRef.setInput('slides', [slide('a'), slide('b'), slide('c')]);
    fixture.componentRef.setInput('kicker', 'Trending this week');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const card = (label: string) =>
      el.querySelector<HTMLElement>(
        `[role="group"] button[aria-label="${label}"]:not([aria-hidden])`,
      );
    const right = [...el.querySelectorAll<HTMLElement>('[role="group"] button')].find((button) =>
      button.style.transform.includes('translateX(88%)'),
    )!;

    right.click();
    fixture.detectChanges();

    expect(right.getAttribute('aria-current')).toBe('true');
    expect(right.style.transform).toContain('translateX(0%)');
    expect(card('Title a')?.style.transform).toContain('translateX(-88%)');
  });

  it('rebuilds the posters instead of sliding old ones when the deck changes', () => {
    const fixture = TestBed.createComponent(HomeStageComponent);
    fixture.componentRef.setInput('slide', slide('a'));
    fixture.componentRef.setInput('slides', [slide('a'), slide('b'), slide('c')]);
    fixture.componentRef.setInput('kicker', 'Trending this week');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cards = () => [...el.querySelectorAll('[role="group"] button')];
    const before = cards();

    fixture.componentRef.setInput('slide', slide('e'));
    fixture.componentRef.setInput('slides', [slide('d'), slide('e'), slide('f')]);
    fixture.detectChanges();

    expect(cards().some((card) => before.includes(card))).toBe(false);
    expect(el.querySelector('#home-stage-title')?.textContent?.trim()).toBe('Title e');
  });

  it('shelves a title the viewer does not own yet, and edits one they do', () => {
    const shelve = vi.fn();
    const edit = vi.fn();
    const fixture = render(slide('a'));
    fixture.componentInstance.shelve.subscribe(shelve);
    fixture.componentInstance.primary();
    expect(shelve).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));

    owned = { id: 'mine', status: 'ongoing', rating: null, media: slide('a').item.media } as never;
    const ownedFixture = render(slide('a'));
    ownedFixture.componentInstance.edit.subscribe(edit);
    ownedFixture.componentInstance.primary();
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ id: 'mine' }));
  });

  it('reports the artwork it shows, or the cover without artwork', () => {
    const fixture = render(slide('a'));
    const active = vi.fn();
    fixture.componentInstance.activeChange.subscribe(active);

    fixture.componentRef.setInput('slide', slide('c', false));
    fixture.detectChanges();

    expect(active).toHaveBeenLastCalledWith('c.jpg');
  });
});
