import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import type { DiscoverCategory, DiscoverFeed } from '@app/core/services/discover/discover.model';
import { artKey } from './home-art';
import { HOME_TYPES, interleave, releaseDateOf, type HomeFilter } from './home-discovery';

export type FeedKind = 'trending' | 'top_rated' | 'new' | 'upcoming' | 'soon';

export const FEED_KINDS: readonly FeedKind[] = ['trending', 'top_rated', 'new', 'upcoming', 'soon'];

export const FEED_SOURCE: Record<FeedKind, DiscoverFeed> = {
  trending: 'trending',
  top_rated: 'top_rated',
  new: 'new',
  upcoming: 'upcoming',
  soon: 'upcoming',
};

const MIXED: readonly DiscoverCategory[] = ['movie', 'tv_show', 'game', 'anime'];
const UPCOMING: ReadonlySet<DiscoverCategory> = new Set(MIXED);

export function isFeedKind(value: string | null | undefined): value is FeedKind {
  return FEED_KINDS.includes(value as FeedKind);
}

export function feedTypes(kind: FeedKind, filter: HomeFilter): DiscoverCategory[] {
  const types = filter === 'all' ? MIXED.filter((type) => HOME_TYPES.includes(type)) : [filter];
  return FEED_SOURCE[kind] === 'upcoming' ? types.filter((type) => UPCOMING.has(type)) : types;
}

export function arrangeFeed(
  kind: FeedKind,
  lists: readonly (readonly CollectionItemResponse[])[],
  today: string,
): CollectionItemResponse[] {
  const dated = (item: CollectionItemResponse) => releaseDateOf(item);
  let items: CollectionItemResponse[];
  switch (kind) {
    case 'trending':
      items = interleave(lists);
      break;
    case 'top_rated':
      items = interleave(lists).filter((item) => item.rating !== null);
      break;
    case 'new':
      items = lists
        .flat()
        .filter((item) => (dated(item) ?? '') !== '' && dated(item)! <= today)
        .sort((a, b) => dated(b)!.localeCompare(dated(a)!));
      break;
    case 'upcoming':
      items = interleave(lists).filter((item) => (dated(item) ?? '') > today);
      break;
    case 'soon':
      items = lists
        .flat()
        .filter((item) => (dated(item) ?? '') > today)
        .sort((a, b) => dated(a)!.localeCompare(dated(b)!));
      break;
  }
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = artKey(item);
    if (!item.media.coverUrl || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
