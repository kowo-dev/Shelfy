import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import type {
  CollectionItemResponse,
  UserMediaStatus,
} from '@app/core/services/collection/collection.model';

export interface PersonCardFields {
  bannerUrl: string | null;
  titleCount: number | null;
  coverUrls: string[];
  followersCount?: number | null;
}

export interface UserSearchResultResponse extends PersonCardFields {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileVisibility: CollectionVisibility;
  isFollowedByCurrentUser: boolean;
}

export interface ProfileStats {
  totalItems: number;
  doneCount: number;
  averageRating: number | null;
  followersCount: number;
  reviewsCount: number;
}

export interface UserProfileResponse {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  profileBannerUrl: string | null;
  profileBannerTitle: string | null;
  profileBannerProvider: string | null;
  profileBannerSourceUrl: string | null;
  profileBannerPosition: number | null;
  profileVisibility: CollectionVisibility;
  isFollowedByCurrentUser: boolean;
  createdAt: string;
  stats: ProfileStats;
  ongoingItems: CollectionItemResponse[];
}

export interface FollowedMediaActivity {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: UserMediaStatus;
  rating: number | null;
  viewCount: number;
  updatedAt: string;
}
