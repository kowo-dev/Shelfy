import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import type { MediaResponse, MediaType } from '@app/core/services/collection/collection.model';
import type { CommentItem } from '@shared/ui/comments/comments.model';

interface MediaListSource {
  id: string;
  name: string;
  creatorUsername: string | null;
}

export interface Contributor {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface MediaListItem {
  mediaId: string;
  addedBy: Contributor | null;
}

export interface UpdateMediaListDetailsRequest {
  name: string;
  description?: string;
  visibility: CollectionVisibility;
  tags: string[];
}

export interface MediaListResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  visibility: CollectionVisibility;
  tags: string[];
  media: MediaResponse[];
  items: MediaListItem[];
  isLikedByViewer: boolean;
  likeCount: number;
  completion: ListCompletionResponse;
  comments: MediaListCommentResponse[];
  commentCount: number;
  collaborators: MediaListCollaboratorResponse[];
  pendingInvites: MediaListCollaboratorResponse[];
  canEditItems: boolean;
  viewerCollaboratorStatus: 'PENDING' | 'ACCEPTED' | null;
  creatorUsername: string | null;
  creatorAvatarUrl: string | null;
  source?: MediaListSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaListSummaryResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  visibility: CollectionVisibility;
  tags: string[];
  itemCount: number;
  previewMedia: MediaResponse[];
  viewerCompleted: number | null;
  likeCount: number;
  commentCount: number;
  creatorUsername: string | null;
  creatorAvatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaListCollaboratorResponse {
  id: string;
  listId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: 'PENDING' | 'ACCEPTED';
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ListCompletionResponse {
  total: number;
  inCollection: number;
  planned: number;
  ongoing: number;
  done: number;
  dropped: number;
  completed: number;
  percentage: number;
}

export type MediaListCommentResponse = CommentItem;
export interface CreateMediaListRequest {
  name: string;
  description?: string;
  visibility: CollectionVisibility;
  tags: string[];
  media: { provider: string; mediaType: MediaType; externalId: string }[];
}
