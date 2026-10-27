import type { TranslateService } from '@app/core/services/translate/translate';
import { aniListLabel, countryLabel } from './anilist-labels.util';
import type { DetailMediaType, MediaDetailView } from './media-detail-view.util';

export interface CatalogRating {
  value: number;
  label: string;
  votes: number | null;
}

export interface MediaStat {
  label: string;
  value: string;
  secondary?: boolean;
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `$${amount.toLocaleString()}`;
}

function mediaStatusLabel(status: string, translate: TranslateService): string {
  return translate.get(`media.status.${status.toLowerCase()}`);
}

type FactRow = [when: unknown, key: string, value: () => string, secondary?: true];

export function buildMediaFacts(
  view: MediaDetailView,
  translate: TranslateService,
  formatDate: (iso: string) => string,
): MediaStat[] {
  const rows: FactRow[] = [
    [view.releaseDate, 'media.release_date', () => formatDate(view.releaseDate!)],
    [view.endDate, 'media.end_date', () => formatDate(view.endDate!), true],
    [view.status, 'media.stat_status', () => mediaStatusLabel(view.status!, translate)],
    [view.runtime, 'media.stat_runtime', () => formatRuntime(view.runtime!)],
    [view.numberOfSeasons, 'media.stat_seasons', () => String(view.numberOfSeasons)],
    [view.numberOfEpisodes, 'media.stat_episodes', () => String(view.numberOfEpisodes)],
    [view.episodes, 'media.stat_episodes', () => String(view.episodes)],
    [view.chapters, 'media.stat_chapters', () => String(view.chapters)],
    [
      view.countryOfOrigin,
      'media.country',
      () => countryLabel(view.countryOfOrigin!, translate.lang()),
      true,
    ],
    [view.format, 'media.format', () => aniListLabel('format', view.format!, translate), true],
    [(view.budget ?? 0) > 0, 'media.stat_budget', () => formatCurrency(view.budget!), true],
    [(view.revenue ?? 0) > 0, 'media.stat_revenue', () => formatCurrency(view.revenue!), true],
  ];
  return rows
    .filter(([when]) => when)
    .map(([, key, value, secondary]) => ({
      label: translate.get(key),
      value: value(),
      ...(secondary && { secondary }),
    }));
}

function formatShortRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${String(rest).padStart(2, '0')}` : `${rest} min`;
}

export function buildHeroMeta(
  mediaType: DetailMediaType,
  view: MediaDetailView,
  translate: TranslateService,
): string[] {
  const count = (key: string, value: number | null) =>
    value ? translate.get('media.meta.' + key, { count: value }) : null;
  const size = {
    movie: view.runtime ? formatShortRuntime(view.runtime) : null,
    tv_show: count('seasons', view.numberOfSeasons),
    anime: count('episodes', view.episodes),
    manga: count('chapters', view.chapters),
    webtoon: count('chapters', view.chapters),
    game: view.platforms.slice(0, 2).join(', ') || null,
  }[mediaType];
  const year = view.releaseYear;
  return [
    translate.get('collection.media_type_one.' + mediaType),
    year ? String(year) : null,
    size,
  ].filter((part): part is string => !!part);
}

const CATALOG_LABEL: Record<DetailMediaType, string> = {
  movie: 'media.stat_tmdb',
  tv_show: 'media.stat_tmdb',
  game: 'media.stat_igdb',
  anime: 'media.stat_anilist',
  manga: 'media.stat_anilist',
  webtoon: 'media.stat_anilist',
};

export function buildCatalogRating(
  mediaType: DetailMediaType,
  view: MediaDetailView,
  translate: TranslateService,
): CatalogRating | null {
  if (view.voteAverage == null) return null;
  return {
    value: Math.round(view.voteAverage * 10) / 10,
    label: translate.get(CATALOG_LABEL[mediaType]),
    votes: view.voteCount ?? null,
  };
}
