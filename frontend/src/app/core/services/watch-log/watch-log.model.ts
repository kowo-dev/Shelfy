export interface WatchLogEntry {
  id: string;
  occurredAt: string;
  isRewatch: boolean;
  name: string | null;
  rating: number | null;
  review: Record<string, unknown> | null;
  containsSpoilers: boolean;
  source: string;
  createdAt: string;
}

export interface UpsertWatchLogRequest {
  occurredAt: string;
  isRewatch: boolean;
  name: string | null;
  rating: number | null;
  review: Record<string, unknown> | null;
  containsSpoilers: boolean;
}
