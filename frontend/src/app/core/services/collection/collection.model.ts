export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
}

export interface CollectionItemResponse {
  id: string;
  userId: string;
  media: MediaResponse;
  status: UserMediaStatus;
  rating: number | null;
  note: Record<string, unknown> | null;
  containsSpoilers: boolean;
  progress: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  episodeSummary?: EpisodeSummary | null;
}

interface EpisodeSummary {
  watched: number;
  total: number | null;
  lastSeason: number;
  lastEpisode: number;
}

export interface MediaResponse {
  id: string;
  canonicalWorkId: string;
  externalId: string;
  provider: string;
  mediaType: MediaType;
  title: string;
  coverUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  isAdult?: boolean;
}

export type MediaType = 'movie' | 'tv_show' | 'anime' | 'manga' | 'webtoon' | 'book' | 'game';

const MEDIA_TYPES: readonly string[] = [
  'movie',
  'tv_show',
  'anime',
  'manga',
  'webtoon',
  'book',
  'game',
];
export const isMediaType = (value: string | null): value is MediaType =>
  value !== null && MEDIA_TYPES.includes(value);

export type ShelfMediaType = Exclude<MediaType, 'book'>;

const HIDDEN_MEDIA_TYPES: ReadonlySet<string> = new Set<MediaType>(['book']);
export const isVisibleMediaType = (type: string): type is ShelfMediaType =>
  !HIDDEN_MEDIA_TYPES.has(type);

export type UserMediaStatus = 'planned' | 'ongoing' | 'done' | 'dropped';

export interface AddToCollectionRequest {
  externalId: string;
  provider: string;
  mediaType: MediaType;
  status: UserMediaStatus;
  rating?: number | null;
  progress?: Record<string, unknown>;
  completedOn?: string;
}

export interface UpdateCollectionItemRequest {
  status?: UserMediaStatus;
  rating?: number | null;
  clearRating?: boolean;
  progress?: Record<string, unknown>;
  note?: Record<string, unknown> | null;
  clearNote?: boolean;
  containsSpoilers?: boolean;
  completedOn?: string;
}

export interface BulkUpdateCollectionItemRequest {
  ids: string[];
  status?: UserMediaStatus;
  rating?: number | null;
  clearRating?: boolean;
}

export type CollectionSortBy = 'title' | 'addedAt' | 'updatedAt' | 'rating';
export type CollectionSortDirection = 'asc' | 'desc';

export type CollectionChangeEvent =
  | { type: 'created' | 'updated'; item: CollectionItemResponse }
  | { type: 'removed'; id: string }
  | { type: 'bulkUpdated'; items: CollectionItemResponse[] }
  | { type: 'bulkRemoved'; ids: string[] }
  | { type: 'cleared' };

export interface CollectionStatsResponse {
  countsByMediaType: Partial<Record<MediaType, number>>;
  total: number;
  countsByStatus?: Partial<Record<UserMediaStatus, number>>;
  countsByMediaTypeAndStatus?: Partial<Record<MediaType, Partial<Record<UserMediaStatus, number>>>>;
  averageRating?: number | null;
}

export interface NextEpisodeResponse {
  item: CollectionItemResponse;
  season: number | null;
  episode: number;
  title: string | null;
  airDate: string;
  airingAt: string | null;
  stillPath: string | null;
}

export interface CollectionListParams {
  page?: number;
  size?: number;
  status?: UserMediaStatus[];
  mediaType?: MediaType[];
  includeUnrated?: boolean;
  minRating?: number;
  maxRating?: number;
  search?: string;
  sortBy?: CollectionSortBy;
  sortDirection?: CollectionSortDirection;
  hasNote?: boolean;
}
