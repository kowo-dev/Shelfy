import type {
  EpisodeProgress,
  RateEpisodeRequest,
  UpdateEpisodeProgressRequest,
} from './episode-progress.model';

export interface EpisodeRef {
  season: number;
  episode: number;
}

export function nextEpisode(progress: EpisodeProgress): EpisodeRef | null {
  for (const s of progress.seasons.filter((s) => s.season > 0)) {
    const seen = new Set(s.watched);
    if (s.total === null) {
      return { season: s.season, episode: Math.max(0, ...s.watched) + 1 };
    }
    for (let episode = 1; episode <= s.total; episode++) {
      if (!seen.has(episode)) return { season: s.season, episode };
    }
  }
  return null;
}

export function watchedCount(progress: EpisodeProgress): number {
  return progress.seasons.filter((s) => s.season > 0).reduce((n, s) => n + s.watched.length, 0);
}

export function totalCount(progress: EpisodeProgress): number | null {
  const regular = progress.seasons.filter((s) => s.season > 0);
  return regular.length > 0 && regular.every((s) => s.total !== null)
    ? regular.reduce((n, s) => n + (s.total ?? 0), 0)
    : null;
}

export function applyEpisodes(
  progress: EpisodeProgress,
  { season, episodes, isWatched }: UpdateEpisodeProgressRequest,
): EpisodeProgress {
  const known = progress.seasons.some((s) => s.season === season);
  const seasons = known
    ? progress.seasons
    : [...progress.seasons, { season, total: null, watched: [], ratings: {} }];
  return {
    ...progress,
    seasons: seasons.map((s) =>
      s.season !== season
        ? s
        : {
            ...s,
            watched: isWatched
              ? [...new Set([...s.watched, ...episodes])].sort((a, b) => a - b)
              : s.watched.filter((e) => !episodes.includes(e)),
            ratings: isWatched
              ? s.ratings
              : Object.fromEntries(
                  Object.entries(s.ratings).filter(([e]) => !episodes.includes(Number(e))),
                ),
          },
    ),
  };
}

export function applyRating(
  progress: EpisodeProgress,
  { season, episode, rating }: RateEpisodeRequest,
): EpisodeProgress {
  const rated =
    rating === null
      ? progress
      : applyEpisodes(progress, { season, episodes: [episode], isWatched: true });
  return {
    ...rated,
    seasons: rated.seasons.map((s) => {
      if (s.season !== season) return s;
      const ratings = { ...s.ratings };
      if (rating === null) delete ratings[episode];
      else ratings[episode] = rating;
      return { ...s, ratings };
    }),
  };
}
