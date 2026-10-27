import type { UserMediaStatus } from '../collection/collection.model';

export interface SeasonProgress {
  season: number;
  total: number | null;
  watched: number[];
  ratings: Record<string, number>;
}

export interface EpisodeProgress {
  seasons: SeasonProgress[];
  isCompleted: boolean;
  status: UserMediaStatus;
}

export interface UpdateEpisodeProgressRequest {
  season: number;
  episodes: number[];
  isWatched: boolean;
}

export interface RateEpisodeRequest {
  season: number;
  episode: number;
  rating: number | null;
}

interface EpisodeAverage {
  season: number;
  episode: number;
  average: number;
  votes: number;
}

interface FollowedEpisodeRatings {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  ratings: { season: number; episode: number; rating: number }[];
}

export interface EpisodeCommunity {
  averages: EpisodeAverage[];
  following: FollowedEpisodeRatings[];
}
