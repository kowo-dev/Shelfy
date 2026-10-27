export interface GameSummary {
  id: number;
  name: string;
  summary: string;
  releaseDate: string | null;
  coverImageId: string | null;
  screenshotImageIds: string[];
  artworkImageIds?: string[];
  genres: string[];
  platforms: string[];
  rating: number;
  ratingCount: number;
  isAdult: boolean;
}

interface FacetRef {
  id: number;
  name: string;
}

interface CompanyRef {
  id: number;
  name: string;
}

export interface GameDetail {
  id: number;
  name: string;
  summary: string;
  storyline: string;
  releaseDate: string | null;
  coverImageId: string | null;
  screenshotImageIds: string[];
  artworkImageIds: string[];
  genres: FacetRef[];
  platforms: FacetRef[];
  themes: FacetRef[];
  developers: CompanyRef[];
  publishers: CompanyRef[];
  gameModes: FacetRef[];
  rating: number;
  ratingCount: number;
  franchiseId: number | null;
  franchiseName: string | null;
  dlcs: GameSummary[];
  isAdult: boolean;
  steamAppIds: string[];
}

export interface CompanyDetail {
  id: number;
  name: string;
  description: string;
  logoImageId: string | null;
  websiteUrl: string | null;
}

export interface FranchiseDetail {
  id: number;
  name: string;
  games: GameSummary[];
}

export interface MediaPageResponse<T> {
  content: T[];
  hasMore: boolean;
}

export type IgdbImageSize =
  | 't_thumb'
  | 't_cover_small'
  | 't_cover_big'
  | 't_cover_big_2x'
  | 't_screenshot_med'
  | 't_screenshot_big'
  | 't_screenshot_huge'
  | 't_1080p';
