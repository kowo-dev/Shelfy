import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AdultGateService } from '@app/core/services/adult-gate/adult-gate';
import { TranslateService } from '@app/core/services/translate/translate';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';
import { CreationCardComponent } from './creation-card';

const media = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Title ${id}`,
  coverUrl: `cover-${id}.jpg`,
  isAdult: false,
  metadata: { backdropUrl: `back-${id}.jpg` },
  ...overrides,
});

const review = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  media: media('1'),
  displayName: 'Kowo',
  username: 'kowo',
  avatarUrl: 'avatar.png',
  likeCount: 5,
  rating: 9,
  content: { type: 'doc', content: [] },
  ...overrides,
});

const list = {
  id: 'l1',
  name: 'Best of',
  creatorUsername: 'kowo',
  creatorAvatarUrl: 'avatar.png',
  likeCount: 3,
  visibility: 'private',
  itemCount: 10,
  previewMedia: [media('1'), media('2'), media('3'), media('4'), media('5')],
};

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
    { title: 'C', coverUrl: 'c.jpg', media: null },
  ],
};

describe('CreationCardComponent', () => {
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
            get: (key: string, params?: Record<string, number>) =>
              params?.['count'] === undefined ? key : `${key}:${params['count']}`,
          },
        },
      ],
    });
  });

  function mount(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(CreationCardComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture;
  }

  const create = (inputs: Record<string, unknown>) => mount(inputs).nativeElement as HTMLElement;

  const colorOf = (value: string) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    return probe.style.color;
  };

  it('links a review to its page and shows the title backdrop, the author, the rating and the likes', () => {
    const el = create({ review: review() });
    const rating = el.querySelector<HTMLElement>('shelfy-rating-value span[style]')!;

    expect(el.querySelector('a')!.getAttribute('href')).toBe('/reviews/r1');
    expect(el.querySelectorAll('.aspect-video img')).toHaveLength(1);
    expect(el.querySelector('.aspect-video img')!.getAttribute('src')).toBe('back-1.jpg');
    expect(el.textContent).toContain('Title 1');
    expect(el.textContent).toContain('Kowo');
    expect(rating.textContent!.trim()).toBe(formatRating(9));
    expect(rating.style.color).toBe(colorOf(ratingToTextColor(9, 100)));
    expect(el.textContent).toContain('5');
  });

  it('shows the author avatar and a text excerpt for a review', () => {
    const el = create({
      review: review({
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A great watch' }] }],
        },
      }),
    });

    expect(el.querySelector('img.size-10')!.getAttribute('src')).toBe('avatar.png');
    expect(el.textContent).toContain('A great watch');
  });

  it('hides the excerpt of a review with spoilers', () => {
    const el = create({
      review: review({
        containsSpoilers: true,
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The twist' }] }],
        },
      }),
    });

    expect(el.textContent).not.toContain('The twist');
  });

  it('links the avatar and the author name to the author profile', () => {
    const el = create({ review: review() });
    const profileLinks = [...el.querySelectorAll('a')].filter((a) =>
      a.getAttribute('href')?.startsWith('/profile/'),
    );

    expect(profileLinks).toHaveLength(2);
    expect(el.querySelector('a.aspect-video')!.getAttribute('href')).toBe('/reviews/r1');
  });

  it('leaves out the rating of an unrated review', () => {
    const el = create({ review: review({ rating: null }) });

    expect(el.querySelector('[style*="color"]')).toBeNull();
  });

  it('shows up to four covers and the titles count for a list', () => {
    const el = create({ list });

    expect(el.querySelector('a')!.getAttribute('href')).toBe('/lists/l1');
    expect(el.querySelectorAll('.aspect-video img')).toHaveLength(4);
    expect(el.textContent).toContain('community.titles_count:10');
  });

  it('shows two covers, a VS chip and the contenders count for a versus', () => {
    const el = create({ pool });

    expect(el.querySelector('a')!.getAttribute('href')).toBe('/versus/p1');
    expect(el.querySelectorAll('.aspect-video img')).toHaveLength(2);
    expect(el.textContent).toContain('VS');
    expect(el.textContent).toContain('community.contenders_count:8');
  });

  it('shows the visibility only when asked to', () => {
    expect(create({ list }).querySelector('[title="community.visibility.private"]')).toBeNull();
    expect(
      create({ list, showVisibility: true }).querySelector(
        '[title="community.visibility.private"]',
      ),
    ).not.toBeNull();
  });

  it('opens the adult gate instead of an adult title', () => {
    const fixture = mount({ review: review({ media: media('1', { isAdult: true, title: '' }) }) });
    const click = new MouseEvent('click', { cancelable: true });

    fixture.componentInstance.onOpen(click, fixture.componentInstance.view());

    expect(click.defaultPrevented).toBe(true);
    expect(adultGate.open).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('adult.hidden');
  });
});
