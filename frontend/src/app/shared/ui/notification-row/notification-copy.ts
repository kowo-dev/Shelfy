import type { IconName } from '@shared/ui/icon/icon-registry';
import type {
  NotificationActor,
  NotificationFamily,
  NotificationResponse,
} from '@app/core/services/notifications/notifications.model';

export interface NotificationCopy {
  lead: string | null;
  key: string;
  params: Record<string, string | number>;
  others: number;
  link: string[] | null;
  query: Record<string, string> | null;
  excerpt: string | null;
  domain: string | null;
}

export const FAMILY_ICONS: Record<NotificationFamily, IconName> = {
  RELATIONS: 'userAdd',
  COMMENTS: 'comment',
  LIKES: 'like',
  COLLABORATION: 'people',
  VERSUS: 'play',
  FEDIVERSE: 'globe',
  ACCOUNT: 'download',
  MODERATION: 'flag',
};

export const REQUEST_TYPES = new Set(['LIST_COLLABORATION_INVITE', 'VERSUS_COLLABORATION_INVITE']);

export function actorName(actor: NotificationActor | null): string {
  return actor ? actor.displayName || actor.username : '';
}

function text(payload: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value) return value;
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function targetLink(payload: Record<string, unknown>): string[] | null {
  switch (payload['kind']) {
    case 'LIST':
      return ['/lists', text(payload, 'listId')];
    case 'VERSUS_POOL':
      return ['/versus', text(payload, 'poolId')];
    case 'REVIEW':
      return ['/reviews', text(payload, 'reviewId')];
    default:
      if (payload['listId']) return ['/lists', text(payload, 'listId')];
      if (payload['poolId']) return ['/versus', text(payload, 'poolId')];
      return null;
  }
}

function typeKey(notification: NotificationResponse): string {
  const { type, payload, isResolved } = notification;
  if (REQUEST_TYPES.has(type) && isResolved) {
    const outcome = payload['outcome'] === 'ACCEPTED' ? 'accepted' : 'declined';
    return `${type.toLowerCase()}_${outcome}`;
  }
  if (type === 'COLLABORATION_REMOVED' && payload['left'] === true) return 'collaboration_left';
  return type.toLowerCase();
}

export function notificationCopy(notification: NotificationResponse): NotificationCopy {
  const { payload, actor, actorCount, type } = notification;
  const title = text(payload, 'title', 'listName', 'poolName', 'mediaTitle');
  const profile = actor ? ['/profile', actor.username] : null;
  const from = [text(payload, 'fromUsername', 'username'), text(payload, 'fromDomain', 'domain')]
    .filter(Boolean)
    .join('@');
  const base: NotificationCopy = {
    lead: actor ? actorName(actor) : null,
    key: `notifications.types.${typeKey(notification)}`,
    params: { title },
    others: Math.max(0, actorCount - 1),
    link: targetLink(payload),
    query:
      notification.family === 'COMMENTS' && payload['kind'] === 'REVIEW'
        ? { tab: 'discussion' }
        : null,
    excerpt: text(payload, 'excerpt') || null,
    domain: actor?.domain ?? null,
  };

  switch (type) {
    case 'REMOTE_FOLLOW_ACCEPTED':
    case 'REMOTE_FOLLOW_REJECTED':
      return { ...base, link: profile };
    case 'NEW_FOLLOWER':
      return { ...base, link: base.others > 0 ? ['/people'] : profile };
    case 'ACCOUNT_MOVED':
      return {
        ...base,
        lead: from || base.lead,
        params: { name: actorName(actor) },
        link: profile,
      };
    case 'REMOTE_ACCOUNT_DELETED':
      return { ...base, lead: text(payload, 'displayName') || from, link: null, domain: null };
    case 'IMPORT_FINISHED':
    case 'IMPORT_FAILED':
      return {
        ...base,
        lead: null,
        params: {
          source: text(payload, 'source') === 'STEAM' ? 'Steam' : 'Letterboxd',
          imported: text(payload, 'imported') || '0',
        },
        link: type === 'IMPORT_FINISHED' ? ['/collection'] : ['/settings'],
        query: type === 'IMPORT_FAILED' ? { section: 'connections' } : null,
      };
    case 'REPORT_RECEIVED':
    case 'DELIVERY_FAILING':
      return {
        ...base,
        lead: null,
        params: { domain: text(payload, 'domain') },
        link: ['/admin'],
        domain: null,
      };
    default:
      return base;
  }
}

export type NotificationAge = 'today' | 'this_week' | 'earlier';

export interface NotificationGroup {
  age: NotificationAge;
  items: NotificationResponse[];
}

export function groupByAge(
  items: NotificationResponse[],
  now: Date = new Date(),
): NotificationGroup[] {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfDay - 6 * 86_400_000;
  const groups: NotificationGroup[] = [];
  for (const item of items) {
    const time = new Date(item.updatedAt).getTime();
    const age: NotificationAge =
      time >= startOfDay ? 'today' : time >= weekAgo ? 'this_week' : 'earlier';
    const last = groups.at(-1);
    if (last?.age === age) last.items.push(item);
    else groups.push({ age, items: [item] });
  }
  return groups;
}
