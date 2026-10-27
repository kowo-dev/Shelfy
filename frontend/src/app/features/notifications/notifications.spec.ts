import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '@app/core/services/auth/auth';
import { DiscoverService } from '@app/core/services/discover/discover';
import { NotificationInbox } from '@app/core/services/notifications/notification-inbox';
import { NotificationsService } from '@app/core/services/notifications/notifications';
import type {
  NotificationResponse,
  NotificationSummary,
} from '@app/core/services/notifications/notifications.model';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';

import { NotificationsPageComponent } from './notifications';

const emptyPage = { content: [], page: 0, size: 20, totalElements: 0 };

function notification(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  const now = new Date().toISOString();
  return {
    id: 'n1',
    type: 'LIST_LIKED',
    family: 'LIKES',
    actor: { id: 'a1', username: 'lea', displayName: 'Léa', avatarUrl: null, domain: null },
    actors: [],
    actorCount: 1,
    targetType: null,
    targetId: null,
    payload: { kind: 'LIST', listId: 'l1', title: 'Rainy nights' },
    createdAt: now,
    updatedAt: now,
    isRead: false,
    isResolved: false,
    ...overrides,
  };
}

describe('NotificationsPageComponent', () => {
  let api: { requests: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
  let summary: ReturnType<typeof signal<NotificationSummary>>;

  function setup(requests: NotificationResponse[], items: NotificationResponse[]) {
    api.requests.mockReturnValue(of(requests));
    api.list.mockReturnValue(of({ ...emptyPage, content: items, totalElements: items.length }));
    const fixture = TestBed.createComponent(NotificationsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    api = { requests: vi.fn(), list: vi.fn() };
    summary = signal<NotificationSummary>({
      total: 2,
      personal: 1,
      families: { LIKES: 1, COLLABORATION: 1 },
      all: 5,
      totals: { LIKES: 4, COLLABORATION: 1 },
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: NotificationsService, useValue: api },
        {
          provide: NotificationInbox,
          useValue: {
            summary,
            unread: computed(() => summary().total),
            hasUnread: computed(() => summary().total > 0),
            markRead: vi.fn(),
            markAllRead: vi.fn(() => of(undefined)),
            answer: vi.fn(() => of(undefined)),
          },
        },
        { provide: AuthService, useValue: { currentUser: signal({ isAdmin: false }) } },
        {
          provide: DiscoverService,
          useValue: { getMovies: () => of(emptyPage), getSeries: () => of(emptyPage) },
        },
        { provide: TmdbService, useValue: { imageUrl: () => null } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
  });

  it('goes back to the profile and shows the unread and total counts in the hero', () => {
    const fixture = setup([], [notification()]);
    const host: HTMLElement = fixture.nativeElement;

    const stats = host.querySelector('shelfy-page-hero p')?.textContent ?? '';
    expect(stats).toContain('2');
    expect(stats).toContain('notifications.stat_unread');
    expect(stats).toContain('5');
    expect(stats).toContain('notifications.stat_total');
  });

  it('lists every family with its total, zero included, and marks families with unread', () => {
    const fixture = setup([], [notification()]);
    const rows = [...fixture.nativeElement.querySelectorAll('shelfy-tabs button')] as HTMLElement[];

    const text = (row: HTMLElement) =>
      [...row.childNodes]
        .filter((node) => node.nodeType !== Node.COMMENT_NODE)
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
        .join(' ');

    expect(rows.map(text)).toEqual([
      'notifications.filters.all notifications.unread_label 5',
      'notifications.filters.RELATIONS 0',
      'notifications.filters.COMMENTS 0',
      'notifications.filters.LIKES notifications.unread_label 4',
      'notifications.filters.COLLABORATION notifications.unread_label 1',
      'notifications.filters.FEDIVERSE 0',
    ]);
    expect(rows[0].getAttribute('aria-selected')).toBe('true');
  });

  it('pins requests first, then groups the rest by day', () => {
    const request = notification({
      id: 'r1',
      type: 'LIST_COLLABORATION_INVITE',
      family: 'COLLABORATION',
    });
    const fixture = setup([request], [notification()]);
    const headings = [...fixture.nativeElement.querySelectorAll('section h2')].map((h) =>
      (h as HTMLElement).textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(headings).toEqual(['notifications.requests 1', 'notifications.today']);
  });

  it('reloads the feed for the picked family and hides the pinned requests', () => {
    const request = notification({ id: 'r1', type: 'LIST_COLLABORATION_INVITE' });
    const fixture = setup([request], []);
    api.list.mockReturnValue(of(emptyPage));

    const likes = fixture.nativeElement.querySelectorAll(
      'shelfy-tabs button',
    )[3] as HTMLButtonElement;
    likes.click();
    fixture.detectChanges();

    expect(api.list).toHaveBeenLastCalledWith(0, 20, 'LIKES');
    expect(likes.getAttribute('aria-selected')).toBe('true');
    expect(fixture.nativeElement.querySelector('#notifications-requests')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('notifications.show_all');
  });

  it('marks everything read from the toolbar', () => {
    const fixture = setup([], [notification()]);
    const inbox = TestBed.inject(NotificationInbox) as unknown as {
      markAllRead: ReturnType<typeof vi.fn>;
    };
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((el) =>
      (el as HTMLElement).textContent?.includes('notifications.mark_all_read'),
    ) as HTMLButtonElement;

    button.click();

    expect(inbox.markAllRead).toHaveBeenCalled();
  });
});
