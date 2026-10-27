import { NEVER, of } from 'rxjs';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import { TranslateService } from '@app/core/services/translate/translate';
import { buildPreviewItem } from '@app/features/discover/data-access/discover-preview.util';

import { entityItemKey } from './entity-media-grid';
import { EntityShelfComponent } from './entity-shelf';

describe('EntityShelfComponent', () => {
  const movie = buildPreviewItem('movie', 1, 'Amélie', 'https://img/a.jpg', 7, null, {});
  const show = buildPreviewItem('tv_show', 2, 'Some Show', 'https://img/b.jpg', 7, null, {});
  let storage: Map<string, string>;

  function create(
    items: CollectionItemResponse[],
    options: { signedIn?: boolean; owned?: CollectionItemResponse[]; hasMore?: boolean } = {},
  ) {
    storage = new Map();
    const found = Object.fromEntries(
      (options.owned ?? []).map((item) => [entityItemKey(item), { ...item, id: 'own' }]),
    );
    TestBed.configureTestingModule({
      imports: [EntityShelfComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: vi.fn(() => (options.signedIn === false ? null : { username: 'me' })),
          },
        },
        {
          provide: CollectionService,
          useValue: { lookupBatch: vi.fn().mockReturnValue(of(found)), changes: NEVER },
        },
        {
          provide: LocalStorageService,
          useValue: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
          },
        },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(EntityShelfComponent);
    fixture.componentRef.setInput('title', 'Brad Pitt');
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('hasMore', options.hasMore ?? false);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ReturnType<typeof create>) => fixture.nativeElement as HTMLElement;

  it('builds the hero poster wall from the titles covers', () => {
    const fixture = create([movie, show]);
    const wall = fixture.componentInstance.wall();
    expect(wall).toHaveLength(30);
    expect(new Set(wall)).toEqual(new Set(['https://img/a.jpg', 'https://img/b.jpg']));
    expect(el(fixture).querySelector('shelfy-page-hero h1')?.textContent).toContain('Brad Pitt');
  });

  it('offers all titles, each media type when mixed, and my shelf when signed in', () => {
    const fixture = create([movie, show], { owned: [movie] });
    expect(
      fixture.componentInstance.showOptions().map((option) => [option.id, option.count]),
    ).toEqual([
      ['all', 2],
      ['movie', 1],
      ['tv_show', 1],
      ['shelf', 1],
    ]);
    expect(el(fixture).querySelectorAll('shelfy-tabs [role=tab]')).toHaveLength(4);
  });

  it('hides the tabs when there is nothing to choose from', () => {
    const fixture = create([movie], { signedIn: false });
    expect(fixture.componentInstance.hasFilters()).toBe(false);
    expect(el(fixture).querySelector('shelfy-tabs')).toBeNull();
  });

  it('filters by media type, shelf and accent-insensitive search', () => {
    const fixture = create([movie, show], { owned: [movie] });
    const component = fixture.componentInstance;

    component.select('tv_show');
    expect(component.visibleCount()).toBe(1);

    component.select('shelf');
    fixture.detectChanges();
    expect(component.visibleCount()).toBe(1);

    component.select('all');
    component.query.set('amelie');
    expect(component.visibleCount()).toBe(1);
  });

  it('explains an empty search and clears it', () => {
    const fixture = create([movie, show]);
    fixture.componentInstance.query.set('zzz');
    fixture.detectChanges();

    expect(el(fixture).textContent).toContain('entity.empty.search_title');
    const clear = Array.from(el(fixture).querySelectorAll('button')).find((button) =>
      button.textContent?.includes('library.empty.clear_search'),
    );
    clear?.click();
    expect(fixture.componentInstance.query()).toBe('');
  });

  it('explains an empty shelf filter and goes back to all titles', () => {
    const fixture = create([movie, show]);
    fixture.componentInstance.select('shelf');
    fixture.detectChanges();

    expect(el(fixture).textContent).toContain('entity.empty.shelf_title');
    const showAll = Array.from(el(fixture).querySelectorAll('button')).find((button) =>
      button.textContent?.includes('entity.empty.show_all'),
    );
    showAll?.click();
    expect(fixture.componentInstance.show()).toBe('all');
  });

  it('keeps the empty message hidden while more titles can still load', () => {
    const fixture = create([movie], { hasMore: true });
    fixture.componentInstance.query.set('zzz');
    fixture.detectChanges();
    expect(el(fixture).textContent).not.toContain('entity.empty.search_title');
    expect(fixture.componentInstance.totalLabel()).toBe('1+');
  });

  it('clamps a long description behind a see more toggle', () => {
    const fixture = create([movie]);
    fixture.componentRef.setInput('description', 'x'.repeat(300));
    fixture.detectChanges();
    const text = el(fixture).querySelector('#entity-description') as HTMLElement;
    expect(text.classList.contains('line-clamp-3')).toBe(true);

    (
      el(fixture).querySelector('[aria-controls="entity-description"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(text.classList.contains('line-clamp-3')).toBe(false);
  });

  it('shows the sort menu only when sorts are given', () => {
    const fixture = create([movie]);
    expect(el(fixture).querySelector('shelfy-entity-sort')).toBeNull();
    fixture.componentRef.setInput('sorts', [
      { id: 'popularity', label: 'Popularity', natural: 'desc' },
    ]);
    fixture.componentRef.setInput('sort', 'popularity');
    fixture.detectChanges();
    expect(el(fixture).querySelector('shelfy-entity-sort')).not.toBeNull();
  });
});
