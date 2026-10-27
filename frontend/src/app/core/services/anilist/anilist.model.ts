export interface AnimeSummary {
  id: number;
  title: string;
  summary: string;
  releaseDate: string | null;
  coverImageUrl: string | null;
  genres: string[];
  rating: number;
  popularity: number;
  episodes: number | null;
  status: string | null;
  bannerImageUrl?: string | null;
}

interface StudioRef {
  id: number;
  name: string;
}

interface StaffCredit {
  id: number;
  name: string;
  role: 'author' | 'director';
}

export interface AnimeDetail extends AnimeSummary {
  endDate: string | null;
  bannerImageUrl: string | null;
  tags: string[];
  studios: StudioRef[];
  format: string | null;
  source: string | null;
  season: string | null;
  seasonYear: number | null;
  countryOfOrigin: string | null;
  characters: AniListCharacter[];
  trailerUrl: string | null;
  creators: StaffCredit[];
}

export interface MangaSummary {
  id: number;
  title: string;
  summary: string;
  releaseDate: string | null;
  coverImageUrl: string | null;
  genres: string[];
  rating: number;
  popularity: number;
  chapters: number | null;
  status: string | null;
  bannerImageUrl?: string | null;
}

export interface MangaDetail extends MangaSummary {
  endDate: string | null;
  bannerImageUrl: string | null;
  tags: string[];
  format: string | null;
  source: string | null;
  countryOfOrigin: string | null;
  volumes: number | null;
  characters: AniListCharacter[];
  trailerUrl: string | null;
  creators: StaffCredit[];
}

export interface AniListCharacter {
  characterId: number;
  name: string;
  imageUrl: string | null;
  role: string | null;
  voiceActorId: number | null;
  japaneseVoiceActor: string | null;
}

export interface AniListEntityMedia {
  id: number;
  mediaType: string;
  title: string;
  coverImageUrl: string | null;
  rating: number;
}

export interface StaffDetail {
  id: number;
  name: string;
  description: string;
  imageUrl: string | null;
  media: AniListEntityMedia[];
}

export interface CharacterDetail {
  id: number;
  name: string;
  description: string;
  imageUrl: string | null;
  media: AniListEntityMedia[];
}

export interface StudioDetail {
  id: number;
  name: string;
  media: AniListEntityMedia[];
}

export interface BrowseMediaResult {
  items: AniListEntityMedia[];
  hasMore: boolean;
}
