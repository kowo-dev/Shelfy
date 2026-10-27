import { signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AdultGateService } from '@app/core/services/adult-gate/adult-gate';
import { TranslateService } from '@app/core/services/translate/translate';
import { CreationTileComponent } from './creation-tile';
import { ReviewCardComponent } from './review-card';

const media = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Title ${id}`,
  coverUrl: `cover-${id}.jpg`,
  isAdult: false,
  metadata: {},
  ...overrides,
});

const review = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  media: media('1'),
  displayName: 'Kowo',
  username: 'kowo',
  avatarUrl: null,
  likeCount: 5,
  rating: 9,
  containsSpoilers: false,
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Wow' }] }],
  },
  updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  ...overrides,
});

const list = (overrides: Record<string, unknown> = {}) => ({
  id: 'l1',
  name: 'Best of',
  creatorUsername: 'kowo',
  creatorAvatarUrl: null,
  likeCount: 3,
  visibility: 'private',
  itemCount: 3,
  previewMedia: [media('1'), media('2', { coverUrl: null }), media('3', { isAdult: true })],
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const pool = {
  id: 'p1',
  name: 'Openings',
  creatorUsername: 'kowo',
  creatorAvatarUrl: null,
  likeCount: 2,
  visibility: 'public',
  itemCount: 8,
  previewEntries: [
    { title: 'A', coverUrl: 'a.jpg', media: null },
    { title: 'B', coverUrl: 'b.jpg', media: null },
  ],
  updatedAt: new Date().toISOString(),
};

describe('community cards', () => {
  const adultGate = { open: vi.fn() };

  beforeEach(() => {
    adultGate.open.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AdultGateService, useValue: adultGate },
        {
          provide: TranslateService,
          useValue: {
            lang: signal('en'),
            get: (key: string, params?: Record<string, unknown>) =>
              params?.['name'] !== undefined ? `${key}:${params['name']}` : key,
          },
        },
      ],
    });
  });

  function mount<T>(type: Type<T>, inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(type);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a review with its cover, quote, author and likes, dated only when asked', () => {
    const plain = mount(ReviewCardComponent, { review: review() });
    const dated = mount(ReviewCardComponent, { review: review(), dated: true });

    expect(plain.querySelector('a')!.getAttribute('href')).toBe('/reviews/r1');
    expect(plain.querySelector('img')!.getAttribute('src')).toBe('cover-1.jpg');
    expect(plain.querySelector('q')!.textContent).toContain('Wow');
    expect(plain.textContent).toContain('Kowo');
    expect(plain.textContent).not.toContain('2 days ago');
    expect(dated.textContent).toContain('2 days ago');
  });

  it('hides a gated review behind the adult gate', () => {
    const fixture = TestBed.createComponent(ReviewCardComponent);
    fixture.componentRef.setInput(
      'review',
      review({ media: media('1', { isAdult: true, title: '' }) }),
    );
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const click = new MouseEvent('click', { cancelable: true });
    fixture.componentInstance.onOpen(click);

    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('adult.hidden');
    expect(click.defaultPrevented).toBe(true);
    expect(adultGate.open).toHaveBeenCalled();
  });

  it('keeps the spoiler warning in place of the quote', () => {
    const el = mount(ReviewCardComponent, { review: review({ containsSpoilers: true }) });

    expect(el.querySelector('q')).toBeNull();
    expect(el.textContent).toContain('home.review_spoilers');
  });

  it('tiles a list with its covers, a title fallback and an adult badge, plus its visibility', () => {
    const el = mount(CreationTileComponent, { list: list(), showVisibility: true });

    expect(el.querySelector('a')!.getAttribute('href')).toBe('/lists/l1');
    expect(el.querySelectorAll('img')).toHaveLength(1);
    expect(el.textContent).toContain('Title 2');
    expect(el.querySelector('shelfy-adult-badge')).not.toBeNull();
    expect(el.textContent).toContain('home.list_by:kowo');
    expect(el.textContent).toContain('community.visibility.private');
  });

  it('marks a versus tile with its VS badge', () => {
    const el = mount(CreationTileComponent, { pool });

    expect(el.querySelector('a')!.getAttribute('href')).toBe('/versus/p1');
    expect(el.querySelectorAll('img')).toHaveLength(2);
    expect(el.textContent).toContain('vs');
    expect(el.textContent).toContain('home.versus_by:kowo');
  });
});
