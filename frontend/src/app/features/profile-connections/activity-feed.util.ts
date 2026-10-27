import type { FeedItem } from '@app/core/services/community/community.model';
import type {
  MediaResponse,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';
import { mediaLogKind } from '@shared/utils/media-log-kind.util';
import { richTextExcerpt } from '@shared/utils/rich-text.util';

const STATUSES: readonly string[] = ['planned', 'ongoing', 'done', 'dropped'];
const GROUP_WINDOW_MS = 3 * 60 * 60 * 1000;
const ORDER: readonly FeedChange[] = ['review', 'rating', 'status', 'added'];

export type FeedChange = 'rating' | 'review' | 'status' | 'added';

export interface FeedEntry {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  media: MediaResponse;
  tags: string[];
  rating: number | null;
  previous: number | null;
  status: UserMediaStatus | null;
  excerpt: string | null;
  spoiler: boolean;
  reviewId: string | null;
  createdAt: string;
}

interface Group {
  key: string;
  oldest: number;
  items: FeedItem[];
}

function score(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function change(item: FeedItem): FeedChange | null {
  switch (item.type) {
    case 'ADDED':
      return 'added';
    case 'REVIEWED':
      return 'review';
    case 'STATUS_CHANGED':
      return STATUSES.includes(item.payload['status'] as string) ? 'status' : null;
    case 'RATED':
      return score(item.payload['rating']) === null ? null : 'rating';
    default:
      return null;
  }
}

function tag(kind: FeedChange, item: FeedItem, media: MediaResponse): string {
  switch (kind) {
    case 'review':
      return item.payload['action'] === 'updated'
        ? 'feed.change.review_updated'
        : 'feed.change.reviewed';
    case 'rating':
      if (item.payload['rewatch'] === true) {
        return `feed.change.rewatched.${mediaLogKind(media.mediaType)}`;
      }
      return score(item.payload['previous']) === null ? 'feed.change.rated' : 'feed.change.rerated';
    case 'status':
      return 'feed.change.status';
    default:
      return 'feed.change.added';
  }
}

function toEntry(items: FeedItem[]): FeedEntry {
  const [newest] = items;
  const media = newest.media!;
  const first = (kind: FeedChange) => items.find((item) => change(item) === kind);
  const rated = items.filter((item) => change(item) === 'rating');
  const review = first('review');
  const status = first('status');
  const rating = rated.length ? score(rated[0].payload['rating']) : (newest.rating ?? null);
  const before = rated.length ? score(rated[rated.length - 1].payload['previous']) : null;
  return {
    id: newest.id,
    username: newest.actor.username,
    name: newest.actor.displayName || newest.actor.username,
    avatarUrl: newest.actor.avatarUrl,
    media,
    tags: ORDER.flatMap((kind) => {
      const source = first(kind);
      return source ? [tag(kind, source, media)] : [];
    }),
    rating,
    previous: before !== null && before !== rating ? before : null,
    status: status ? (status.payload['status'] as UserMediaStatus) : null,
    excerpt: review?.review ? richTextExcerpt(review.review, 220) || null : null,
    spoiler: review?.containsSpoilers ?? false,
    reviewId: review?.reviewId ?? null,
    createdAt: newest.createdAt,
  };
}

export function groupFeed(items: readonly FeedItem[]): FeedEntry[] {
  const groups: Group[] = [];
  const open = new Map<string, Group>();
  for (const item of items) {
    if (!item.media || !change(item)) continue;
    const key = `${item.actor.id}:${item.media.id}`;
    const at = Date.parse(item.createdAt);
    const group = open.get(key);
    if (group && group.oldest - at <= GROUP_WINDOW_MS) {
      group.items.push(item);
      group.oldest = at;
      continue;
    }
    const fresh = { key, oldest: at, items: [item] };
    groups.push(fresh);
    open.set(key, fresh);
  }
  return groups.map((group) => toEntry(group.items));
}
