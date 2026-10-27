import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ConfirmService } from '@app/core/services/confirm/confirm';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { NotificationFeed } from './notification-feed';
import { NotificationInbox } from './notification-inbox';
import { NotificationsService } from './notifications';
import type { NotificationResponse } from './notifications.model';

function notification(id: string): NotificationResponse {
  return {
    id,
    type: 'CREATION_LIKED',
    family: 'LIKES',
    actor: null,
    actors: [],
    actorCount: 1,
    targetType: null,
    targetId: null,
    payload: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isRead: true,
    isResolved: false,
  };
}

describe('NotificationFeed', () => {
  let inbox: { clear: ReturnType<typeof vi.fn>; clearAll: ReturnType<typeof vi.fn> };
  let confirm: { ask: ReturnType<typeof vi.fn> };
  let toast: { error: ReturnType<typeof vi.fn> };
  let feed: NotificationFeed;

  beforeEach(() => {
    inbox = { clear: vi.fn().mockReturnValue(of(undefined)), clearAll: vi.fn() };
    confirm = { ask: vi.fn() };
    toast = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        NotificationFeed,
        {
          provide: NotificationsService,
          useValue: {
            requests: () => of([]),
            list: () =>
              of({
                content: [notification('a'), notification('b')],
                page: 0,
                size: 20,
                totalElements: 2,
              }),
          },
        },
        { provide: NotificationInbox, useValue: inbox },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: TranslateService, useValue: { get: (key: string) => key } },
      ],
    });
    feed = TestBed.inject(NotificationFeed);
    feed.load();
  });

  it('removes a cleared notification right away', () => {
    feed.clear(notification('a'));

    expect(inbox.clear).toHaveBeenCalled();
    expect(feed.items().map((item) => item.id)).toEqual(['b']);
  });

  it('puts the notification back when clearing fails', () => {
    inbox.clear.mockReturnValue(throwError(() => ({ status: 500 })));

    feed.clear(notification('a'));

    expect(feed.items().map((item) => item.id)).toEqual(['a', 'b']);
    expect(toast.error).toHaveBeenCalled();
  });

  it('clears everything only after confirmation', async () => {
    confirm.ask.mockResolvedValue(false);
    await feed.clearAll();
    expect(inbox.clearAll).not.toHaveBeenCalled();

    confirm.ask.mockResolvedValue(true);
    inbox.clearAll.mockReturnValue(of(undefined));
    await feed.clearAll();

    expect(inbox.clearAll).toHaveBeenCalled();
    expect(feed.items()).toEqual([]);
    expect(feed.clearable()).toBe(false);
  });
});
