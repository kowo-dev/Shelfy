import type { NotificationResponse } from '@app/core/services/notifications/notifications.model';
import { groupByAge, notificationCopy } from './notification-copy';

const lea = {
  id: 'u1',
  username: 'lea@bookwyrm.social',
  displayName: 'Léa',
  avatarUrl: null,
  domain: 'bookwyrm.social',
};

function notification(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: 'n1',
    type: 'CREATION_LIKED',
    family: 'LIKES',
    actor: lea,
    actors: [lea],
    actorCount: 1,
    targetType: 'LIST',
    targetId: 'l1',
    payload: { kind: 'LIST', listId: 'l1', title: 'Best Ghibli' },
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
    isRead: false,
    isResolved: false,
    ...overrides,
  };
}

describe('notificationCopy', () => {
  it('opens the discussion tab for a comment on a review', () => {
    const copy = notificationCopy(
      notification({
        type: 'REVIEW_COMMENTED',
        family: 'COMMENTS',
        payload: { kind: 'REVIEW', reviewId: 'r1' },
      }),
    );

    expect(copy.link).toEqual(['/reviews', 'r1']);
    expect(copy.query).toEqual({ tab: 'discussion' });
  });

  it('leads with the actor and links to the liked creation', () => {
    const copy = notificationCopy(notification({ actorCount: 5 }));

    expect(copy.lead).toBe('Léa');
    expect(copy.key).toBe('notifications.types.creation_liked');
    expect(copy.params).toEqual({ title: 'Best Ghibli' });
    expect(copy.others).toBe(4);
    expect(copy.link).toEqual(['/lists', 'l1']);
    expect(copy.domain).toBe('bookwyrm.social');
  });

  it('describes an answered request with its outcome', () => {
    const copy = notificationCopy(
      notification({
        type: 'LIST_COLLABORATION_INVITE',
        family: 'COLLABORATION',
        isResolved: true,
        payload: { kind: 'LIST', listId: 'l1', outcome: 'ACCEPTED' },
      }),
    );

    expect(copy.key).toBe('notifications.types.list_collaboration_invite_accepted');
    expect(copy.link).toEqual(['/lists', 'l1']);
  });

  it('sends failed imports to the connections settings', () => {
    const copy = notificationCopy(
      notification({
        type: 'IMPORT_FAILED',
        family: 'ACCOUNT',
        actor: null,
        actors: [],
        actorCount: 0,
        payload: { source: 'STEAM', code: 'X' },
      }),
    );

    expect(copy.lead).toBeNull();
    expect(copy.params['source']).toBe('Steam');
    expect(copy.link).toEqual(['/settings']);
    expect(copy.query).toEqual({ section: 'connections' });
  });
});

describe('groupByAge', () => {
  it('splits today, this week and earlier in order', () => {
    const now = new Date(2026, 9, 20, 12);
    const at = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

    const groups = groupByAge(
      [
        notification({ id: 'a', updatedAt: at(0) }),
        notification({ id: 'b', updatedAt: at(2) }),
        notification({ id: 'c', updatedAt: at(3) }),
        notification({ id: 'd', updatedAt: at(30) }),
      ],
      now,
    );

    expect(groups.map((group) => [group.age, group.items.map((item) => item.id)])).toEqual([
      ['today', ['a']],
      ['this_week', ['b', 'c']],
      ['earlier', ['d']],
    ]);
  });
});
