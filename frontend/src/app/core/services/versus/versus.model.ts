import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import type {
  MediaResponse,
  MediaType,
  PagedResponse,
} from '@app/core/services/collection/collection.model';
import type { CommentItem } from '@shared/ui/comments/comments.model';
import type { Contributor } from '@app/core/services/lists/lists.model';

export type { PagedResponse };

export type VersusSessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface VersusMediaReference {
  provider: string;
  mediaType: MediaType;
  externalId: string;
}

type VersusClipProvider = 'youtube';

export interface VersusClip {
  provider: VersusClipProvider;
  externalId: string;
  title: string;
  author: string | null;
  startSeconds: number | null;
}

export interface VersusEntry {
  id: string;
  title: string;
  coverUrl: string | null;
  media: MediaResponse | null;
  clip: VersusClip | null;
  addedBy?: Contributor | null;
}

export interface AddVersusClipRequest {
  url: string;
  startSeconds?: number | null;
  linkedMedia?: VersusMediaReference | null;
}

export interface UpdateVersusClipRequest {
  startSeconds: number | null;
  linkedMedia: VersusMediaReference | null;
}

export interface CreateVersusPoolRequest {
  name: string;
  description?: string;
  visibility: CollectionVisibility;
}

export interface VersusPoolResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  visibility: CollectionVisibility;
  entries: VersusEntry[];
  canEdit: boolean;
  isOwner: boolean;
  isLikedByViewer: boolean;
  likeCount: number;
  comments: CommentItem[];
  commentCount: number;
  creatorUsername: string | null;
  creatorAvatarUrl: string | null;
  collaborators: VersusPoolCollaboratorResponse[];
  pendingInvites: VersusPoolCollaboratorResponse[];
  viewerCollaboratorStatus: 'PENDING' | 'ACCEPTED' | null;
  source: VersusPoolSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface VersusPoolCollaboratorResponse {
  id: string;
  poolId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: 'PENDING' | 'ACCEPTED';
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface VersusPoolSource {
  id: string;
  name: string;
  creatorUsername: string | null;
}

export interface VersusPoolSummaryResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  visibility: CollectionVisibility;
  itemCount: number;
  previewEntries: VersusEntry[];
  likeCount: number;
  commentCount: number;
  creatorUsername: string | null;
  creatorAvatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VersusMatchResponse {
  id: string;
  round: number;
  slotIndex: number;
  entryA: VersusEntry | null;
  entryB: VersusEntry | null;
  winnerEntryId: string | null;
  isDecided: boolean;
}

export interface StartVersusSessionResponse {
  sessionId: string;
  poolId: string;
  status: VersusSessionStatus;
  bracketSize: number;
  roundsTotal: number;
  currentRound: number;
  currentMatch: VersusMatchResponse | null;
  winnerEntry: VersusEntry | null;
}

interface VersusPlayer {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface VersusPodiumEntry {
  entry: VersusEntry;
  place: number;
  communityRank: number | null;
}

export interface VersusSessionResult {
  sessionId: string;
  poolId: string;
  poolName: string;
  player: VersusPlayer;
  completedAt: string;
  entryCount: number;
  podium: VersusPodiumEntry[];
  agreement: number;
  communitySessionCount: number;
  gaps: VersusPodiumEntry[];
}

export interface VersusFollowedSession {
  sessionId: string;
  player: VersusPlayer;
  winner: VersusEntry | null;
  completedAt: string;
}

export interface VersusMediaRankingEntry {
  entry: VersusEntry;
  appearances: number;
  wins: number;
  avgPoints: number;
  winRate: number;
}

export interface VersusPoolResultsResponse {
  poolId: string;
  completedSessionCount: number;
  ranking: VersusMediaRankingEntry[];
}
