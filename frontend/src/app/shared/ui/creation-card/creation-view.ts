import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import type { MediaResponse } from '@app/core/services/collection/collection.model';
import type {
  MediaListResponse,
  MediaListSummaryResponse,
} from '@app/core/services/lists/lists.model';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import type { VersusPoolSummaryResponse } from '@app/core/services/versus/versus.model';
import { imageRendition } from '@shared/utils/image-rendition.util';
import { mediaBackdropUrl } from '@shared/utils/media-backdrop.util';
import { richTextExcerpt } from '@shared/utils/rich-text.util';

export type CreationCardKind = 'list' | 'versus' | 'review';

interface CardCover {
  url: string | null;
  adult: boolean;
  title: string | null;
}

export interface CreationView {
  kind: CreationCardKind;
  route: unknown[];
  title: string;
  covers: CardCover[];
  gated: boolean;
  creator: string | null;
  creatorRoute: unknown[] | null;
  creatorAvatar: string | null;
  excerpt: string | null;
  countKey: string | null;
  count: number;
  likes: number;
  comments: number;
  rating: number | null;
  visibility: CollectionVisibility | null;
}

export interface CreationSource {
  list?: MediaListSummaryResponse | MediaListResponse | null;
  pool?: VersusPoolSummaryResponse | null;
  review?: ReviewResponse | null;
}

const coverOf = (media: MediaResponse | null | undefined, title?: string | null): CardCover => ({
  url: media?.coverUrl ? imageRendition(media.coverUrl, 'card') : null,
  adult: !!media?.isAdult,
  title: media?.title || title || null,
});

const profileRoute = (username: string | null | undefined): unknown[] | null =>
  username ? ['/profile', username] : null;

const BASE = { countKey: null, count: 0, rating: null, visibility: null, excerpt: null };

function versusView(pool: VersusPoolSummaryResponse): CreationView {
  return {
    ...BASE,
    kind: 'versus',
    route: ['/versus', pool.id],
    title: pool.name,
    covers: pool.previewEntries
      .slice(0, 2)
      .map((entry) =>
        entry.media
          ? coverOf(entry.media, entry.title)
          : { url: entry.coverUrl, adult: false, title: entry.title },
      ),
    gated: false,
    creator: pool.creatorUsername,
    creatorRoute: profileRoute(pool.creatorUsername),
    creatorAvatar: pool.creatorAvatarUrl,
    countKey: 'community.contenders_count',
    count: pool.itemCount,
    likes: pool.likeCount,
    comments: pool.commentCount,
    visibility: pool.visibility,
  };
}

function reviewView(review: ReviewResponse): CreationView {
  return {
    ...BASE,
    kind: 'review',
    route: ['/reviews', review.id],
    title: review.media.title,
    covers: [{ ...coverOf(review.media), url: mediaBackdropUrl(review.media, 'wide') }],
    gated: !!review.media.isAdult && !review.media.title,
    creator: review.displayName || review.username,
    creatorRoute: profileRoute(review.username),
    creatorAvatar: review.avatarUrl,
    excerpt: review.containsSpoilers
      ? null
      : richTextExcerpt(review.content as Parameters<typeof richTextExcerpt>[0], 200) || null,
    likes: review.likeCount,
    comments: review.commentCount,
    rating: review.rating ?? null,
  };
}

function listView(list: MediaListSummaryResponse | MediaListResponse): CreationView {
  const preview = 'previewMedia' in list ? list.previewMedia : list.media;
  return {
    ...BASE,
    kind: 'list',
    route: ['/lists', list.id],
    title: list.name,
    covers: preview.slice(0, 4).map((media) => coverOf(media)),
    gated: false,
    creator: list.creatorUsername,
    creatorRoute: profileRoute(list.creatorUsername),
    creatorAvatar: list.creatorAvatarUrl,
    countKey: 'community.titles_count',
    count: 'itemCount' in list ? list.itemCount : list.media.length,
    likes: list.likeCount,
    comments: list.commentCount,
    visibility: list.visibility,
  };
}

export function creationView({ list, pool, review }: CreationSource): CreationView | null {
  if (pool) return versusView(pool);
  if (review) return reviewView(review);
  return list ? listView(list) : null;
}
