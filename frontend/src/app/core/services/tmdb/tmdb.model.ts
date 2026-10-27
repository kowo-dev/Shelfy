interface MediaGenre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface TmdbSearchResponse<T> {
  results: T[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export interface MovieSummary {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  genreIds: number[];
  voteAverage: number;
  voteCount: number;
  isAdult: boolean;
}

interface CompanyRef {
  id: number;
  name: string;
  logoPath: string | null;
}

interface PersonRef {
  id: number;
  name: string;
}

export interface MovieDetail {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  runtime: number | null;
  genres: MediaGenre[];
  voteAverage: number;
  voteCount: number;
  isAdult: boolean;
  budget: number | null;
  revenue: number | null;
  productionCompanies: CompanyRef[];
  director: PersonRef | null;
  backdropImagePaths: string[];
  posterImagePaths: string[];
  cast: CastMember[];
  trailerUrl?: string | null;
}

export interface TvShowSummary {
  id: number;
  name: string;
  originalName: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  firstAirDate: string | null;
  genreIds: number[];
  voteAverage: number;
  voteCount: number;
  isAdult: boolean;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterPath: string | null;
  airDate: string | null;
}

interface Episode {
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  stillPath: string | null;
  runtime: number | null;
  voteAverage: number | null;
  voteCount: number | null;
}

export interface SeasonDetail {
  seasonNumber: number;
  name: string;
  overview: string;
  posterPath: string | null;
  episodes: Episode[];
}

export interface TvShowDetail {
  id: number;
  name: string;
  originalName: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  firstAirDate: string | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  seasons: SeasonSummary[];
  genres: MediaGenre[];
  voteAverage: number;
  voteCount: number;
  productionCompanies: CompanyRef[];
  networks: CompanyRef[];
  backdropImagePaths: string[];
  posterImagePaths: string[];
  cast: CastMember[];
  isAdult: boolean;
  trailerUrl?: string | null;
}

export interface PersonCredit {
  mediaId: number;
  mediaType: string;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  character: string | null;
  job: string | null;
  popularity: number;
  voteAverage: number;
}

export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  profilePath: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  credits: PersonCredit[];
}

export interface CompanyDetail {
  id: number;
  name: string;
  description: string;
  headquarters: string | null;
  originCountry: string | null;
}

export type TmdbImageSize = 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original';
