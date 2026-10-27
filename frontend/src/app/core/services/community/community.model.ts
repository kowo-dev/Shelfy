import type { MediaResponse, MediaType } from '../collection/collection.model';
import type { UserActivityResponse } from '../users/user-profile.model';

export type CommunityScope = 'ALL' | 'CIRCLE' | 'REMOTE' | 'MINE';
export type CommunitySort = 'RECENT' | 'POPULAR';

export interface CommunityQuery {
  q?: string;
  scope?: CommunityScope;
  sort?: CommunitySort;
  mediaType?: MediaType | null;
}

interface FeedActor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FeedItem {
  id: string;
  type: UserActivityResponse['type'];
  actor: FeedActor;
  media: MediaResponse | null;
  reviewId: string | null;
  payload: Record<string, unknown>;
  rating: number | null;
  review: Record<string, unknown> | null;
  containsSpoilers: boolean;
  createdAt: string;
}

export interface FeedPage {
  items: FeedItem[];
  nextBefore: string | null;
}
