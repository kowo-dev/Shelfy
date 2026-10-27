export type NotificationFamily =
  | 'RELATIONS'
  | 'COMMENTS'
  | 'LIKES'
  | 'COLLABORATION'
  | 'VERSUS'
  | 'FEDIVERSE'
  | 'ACCOUNT'
  | 'MODERATION';

export type NotificationAudience = 'EVERYONE' | 'CONNECTIONS';

export interface NotificationActor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  domain: string | null;
}

export interface NotificationResponse {
  id: string;
  type: string;
  family: NotificationFamily;
  actor: NotificationActor | null;
  actors: NotificationActor[];
  actorCount: number;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  isResolved: boolean;
}

export interface NotificationSettingState {
  setting: string;
  isEnabled: boolean;
  isEnabledByDefault: boolean;
}

export interface NotificationFamilyState {
  family: NotificationFamily;
  isEnabled: boolean;
  settings: NotificationSettingState[];
}

export interface NotificationPreferences {
  audience: NotificationAudience;
  families: NotificationFamilyState[];
}

export interface NotificationPreferencesUpdate {
  audience?: NotificationAudience;
  families?: Partial<Record<NotificationFamily, boolean>>;
  settings?: Record<string, boolean>;
}

export interface NotificationSummary {
  total: number;
  personal: number;
  families: Partial<Record<NotificationFamily, number>>;
  all: number;
  totals: Partial<Record<NotificationFamily, number>>;
}
