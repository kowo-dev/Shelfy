import type { MediaType } from '@app/core/services/collection/collection.model';

export interface SearchResult {
  provider: string;
  mediaType: MediaType;
  externalId: string;
  title: string;
  posterPath: string | null;
  overview: string;
  releaseYear: number | null;
  genres: string[];
  voteAverage: number | null;
  voteCount: number | null;
  status: string | null;
  isInCollection: boolean;
  backdropPath?: string | null;
}

export interface SearchResponse {
  results: SearchResult[];
  page: number;
  hasMore: boolean;
  unavailableProviders: string[];
}

export interface ExploreResponse extends SearchResponse {
  skippedTypes: MediaType[];
}

export type ExploreCriterionGroup = 'genre' | 'theme';

export interface ExploreVocabularyEntry {
  id: string;
  group: ExploreCriterionGroup;
  mediaTypes: MediaType[];
}

export interface ExploreOption {
  id: string;
  label: string;
  group: string;
  logoPath: string | null;
}

export interface ExploreVocabulary {
  criteria: ExploreVocabularyEntry[];
  platforms: ExploreOption[];
}
