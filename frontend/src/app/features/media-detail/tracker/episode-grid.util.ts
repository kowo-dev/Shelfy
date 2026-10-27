import type {
  EpisodeCommunity,
  EpisodeProgress,
  SeasonProgress,
} from '@app/core/services/episode-progress/episode-progress.model';
import type { SeasonDetail, SeasonSummary } from '@app/core/services/tmdb/tmdb.model';

export type RatingSource = 'mine' | 'community' | 'tmdb';

interface ScoreWithVotes {
  average: number;
  votes: number;
}

interface FriendScore {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  rating: number;
}

export interface EpisodeCell {
  season: number;
  episode: number;
  title: string | null;
  overview: string | null;
  stillPath: string | null;
  airDate: string | null;
  runtime: number | null;
  released: boolean;
  watched: boolean;
  mine: number | null;
  community: ScoreWithVotes | null;
  tmdb: ScoreWithVotes | null;
  friends: FriendScore[];
}

export interface SeasonColumn {
  season: number;
  name: string | null;
  episodes: EpisodeCell[];
  watched: number;
  released: number;
  averages: Record<RatingSource, number | null>;
}

export interface TrackerStats {
  watched: number;
  released: number;
  percent: number;
  minutesWatched: number | null;
  minutesLeft: number | null;
  rated: number;
  averages: Record<RatingSource, number | null>;
  best: EpisodeCell | null;
  worst: EpisodeCell | null;
}

const HEAT: [score: number, cssVar: string][] = [
  [5, '--color-rating-low'],
  [6.5, '--color-rating-mid'],
  [8, '--color-rating-good'],
  [9, '--color-rating-high'],
];

export function heatColor(score: number): string {
  const next = HEAT.findIndex(([stop]) => score < stop);
  if (next === 0) return `var(${HEAT[0][1]})`;
  if (next === -1) return `var(${HEAT.at(-1)![1]})`;
  const [from, low] = HEAT[next - 1];
  const [to, high] = HEAT[next];
  const share = Math.round(((to - score) / (to - from)) * 100);
  return `color-mix(in oklch, var(${low}) ${share}%, var(${high}))`;
}

const SOURCES: readonly RatingSource[] = ['mine', 'community', 'tmdb'];

export function scoreOf(cell: EpisodeCell, source: RatingSource): number | null {
  switch (source) {
    case 'mine':
      return cell.mine;
    case 'community':
      return cell.community?.average ?? null;
    case 'tmdb':
      return cell.tmdb?.average ?? null;
  }
}

export function displayScore(cell: EpisodeCell, source: RatingSource): number | null {
  return cell.mine ?? scoreOf(cell, source);
}

export function externalSource(columns: readonly SeasonColumn[]): RatingSource {
  return columns.some((c) => c.episodes.some((e) => e.tmdb !== null)) ? 'tmdb' : 'community';
}

export function seasonAverage(column: SeasonColumn, source: RatingSource): number | null {
  return column.averages.mine ?? column.averages[source];
}

function mean(values: readonly (number | null)[]): number | null {
  const scores = values.filter((v): v is number => v !== null);
  return scores.length ? scores.reduce((sum, v) => sum + v, 0) / scores.length : null;
}

function averagesOf(cells: readonly EpisodeCell[]): Record<RatingSource, number | null> {
  return Object.fromEntries(
    SOURCES.map((source) => [source, mean(cells.map((cell) => scoreOf(cell, source)))]),
  ) as Record<RatingSource, number | null>;
}

const key = (season: number, episode: number) => `${season}:${episode}`;

interface CommunityLookups {
  averages: Map<string, ScoreWithVotes>;
  friends: Map<string, FriendScore[]>;
}

function communityLookups(community: EpisodeCommunity | null): CommunityLookups {
  const averages = new Map(
    (community?.averages ?? []).map((a) => [
      key(a.season, a.episode),
      { average: a.average, votes: a.votes },
    ]),
  );
  const friends = new Map<string, FriendScore[]>();
  for (const friend of community?.following ?? []) {
    for (const r of friend.ratings) {
      const k = key(r.season, r.episode);
      friends.set(k, [
        ...(friends.get(k) ?? []),
        {
          username: friend.username,
          displayName: friend.displayName,
          avatarUrl: friend.avatarUrl,
          rating: r.rating,
        },
      ]);
    }
  }
  return { averages, friends };
}

function buildCell(
  season: number,
  episode: number,
  detail: SeasonDetail | undefined,
  own: SeasonProgress | undefined,
  lookups: CommunityLookups,
  today: string,
): EpisodeCell {
  const meta = detail?.episodes.find((e) => e.episodeNumber === episode);
  const airDate = meta?.airDate ?? null;
  return {
    season,
    episode,
    title: meta?.name || null,
    overview: meta?.overview || null,
    stillPath: meta?.stillPath ?? null,
    airDate,
    runtime: meta?.runtime ?? null,
    released: !detail || (airDate !== null && airDate <= today),
    watched: own?.watched.includes(episode) ?? false,
    mine: own?.ratings[episode] ?? null,
    community: lookups.averages.get(key(season, episode)) ?? null,
    tmdb:
      meta?.voteCount && meta.voteAverage
        ? { average: meta.voteAverage, votes: meta.voteCount }
        : null,
    friends: lookups.friends.get(key(season, episode)) ?? [],
  };
}

function episodeCount(
  detail: SeasonDetail | undefined,
  summary: SeasonSummary | undefined,
  own: SeasonProgress | undefined,
): number {
  return (
    detail?.episodes.length ||
    summary?.episodeCount ||
    own?.total ||
    Math.max(0, ...(own?.watched ?? []))
  );
}

export function buildSeasonColumns(
  progress: EpisodeProgress,
  options: {
    summaries?: readonly SeasonSummary[];
    details?: ReadonlyMap<number, SeasonDetail>;
    community?: EpisodeCommunity | null;
    today?: string;
  } = {},
): SeasonColumn[] {
  const { summaries = [], community = null } = options;
  const details = options.details ?? new Map<number, SeasonDetail>();
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const lookups = communityLookups(community);

  const numbers = new Set<number>([
    ...summaries.map((s) => s.seasonNumber),
    ...progress.seasons.map((s) => s.season),
  ]);

  return [...numbers]
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
    .map((number) => {
      const summary = summaries.find((s) => s.seasonNumber === number);
      const detail = details.get(number);
      const own = progress.seasons.find((s) => s.season === number);
      const episodes = Array.from({ length: episodeCount(detail, summary, own) }, (_, i) =>
        buildCell(number, i + 1, detail, own, lookups, today),
      );
      return {
        season: number,
        name: summary?.name ?? null,
        episodes,
        watched: episodes.filter((e) => e.watched).length,
        released: episodes.filter((e) => e.released).length,
        averages: averagesOf(episodes),
      };
    });
}

export function trackerStats(columns: readonly SeasonColumn[], source: RatingSource): TrackerStats {
  const cells = columns.flatMap((c) => c.episodes);
  const watchedCells = cells.filter((c) => c.watched);
  const released = cells.filter((c) => c.released).length;
  const runtimes = watchedCells.map((c) => c.runtime);
  const scored = cells
    .map((cell) => ({ cell, score: scoreOf(cell, source) }))
    .filter((s): s is { cell: EpisodeCell; score: number } => s.score !== null);
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  return {
    watched: watchedCells.length,
    released,
    percent: released ? Math.min(100, Math.round((watchedCells.length / released) * 100)) : 0,
    minutesWatched: runtimes.some((r) => r !== null)
      ? runtimes.reduce<number>((sum, r) => sum + (r ?? 0), 0)
      : null,
    minutesLeft: cells.some((c) => c.runtime !== null)
      ? cells
          .filter((c) => c.released && !c.watched)
          .reduce<number>((sum, c) => sum + (c.runtime ?? 0), 0)
      : null,
    rated: cells.filter((c) => c.mine !== null).length,
    averages: averagesOf(cells),
    best: ranked.length > 1 ? ranked[0].cell : null,
    worst: ranked.length > 1 ? ranked[ranked.length - 1].cell : null,
  };
}

export function releasedNeighbours(
  columns: readonly SeasonColumn[],
  cell: EpisodeCell,
): { previous: EpisodeCell | null; next: EpisodeCell | null } {
  const released = columns.flatMap((c) => c.episodes).filter((e) => e.released);
  const index = released.findIndex((e) => e.season === cell.season && e.episode === cell.episode);
  if (index < 0) return { previous: null, next: null };
  return { previous: released[index - 1] ?? null, next: released[index + 1] ?? null };
}
