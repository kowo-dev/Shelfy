import type { MediaResponse } from '@app/core/services/collection/collection.model';
import type { CommentItem } from '@shared/ui/comments/comments.model';
export interface ReviewResponse {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  media: MediaResponse;
  rating: number | null;
  content: Record<string, unknown>;
  containsSpoilers: boolean;
  isLikedByViewer: boolean;
  likeCount: number;
  comments: CommentItem[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserActivityResponse {
  id: string;
  type: 'ADDED' | 'REVIEWED' | 'RATED' | 'STATUS_CHANGED' | 'COMMENTED';
  media: MediaResponse | null;
  payload: Record<string, unknown>;
  createdAt: string;
}
