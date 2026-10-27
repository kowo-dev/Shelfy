import type { Observable } from 'rxjs';
import type { PagedResponse } from '@app/core/services/collection/collection.model';

export type CommentSortMode = 'relevance' | 'recent';
export type CommentVoteValue = 1 | -1;

export interface CommentItem {
  id: string;
  authorId: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  upvotes: number;
  downvotes: number;
  myVote: CommentVoteValue | null;
  parentCommentId: string | null;
  isDeleted: boolean;
  replies: CommentItem[];
}

export interface MentionCandidate {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface CommentsSource {
  list(page: number, size?: number, sort?: CommentSortMode): Observable<PagedResponse<CommentItem>>;
  add(content: string, parentCommentId?: string): Observable<CommentItem>;
  update(commentId: string, content: string): Observable<CommentItem>;
  remove(commentId: string): Observable<void>;
  vote(commentId: string, value: CommentVoteValue): Observable<CommentItem>;
  removeVote(commentId: string): Observable<CommentItem>;
}
