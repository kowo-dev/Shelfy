export type CollectionVisibility = 'public' | 'link' | 'private';

export interface User {
  id: string;
  email: string;
  pendingEmail: string | null;
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
  hasOptedOutOfFederation: boolean;
  isAdultContentAllowed: boolean;
  hasConfirmedAdultContent: boolean;
  isEmailVerified: boolean;
  isSteamConnected: boolean;
  steamDisplayName: string | null;
  isSteamAvailable: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export interface UpdateProfilePayload {
  username: string;
  displayName: string | null;
  bio: string | null;
  profileVisibility: CollectionVisibility;
  isAdultContentAllowed: boolean;
  confirmAdultContent: boolean;
  hasOptedOutOfFederation?: boolean;
}

export interface UpdateProfileBannerPayload {
  bannerUrl: string;
  title: string;
  provider: string;
  sourceUrl: string;
  position: number;
}

export interface UsernameAvailabilityResponse {
  isAvailable: boolean;
}

export interface RequestEmailChangePayload {
  newEmail: string;
}

export interface ConfirmEmailChangePayload {
  token: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface VerifyEmailPayload {
  token: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}
