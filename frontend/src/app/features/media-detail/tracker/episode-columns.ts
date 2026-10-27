import { computed, effect, inject, signal, type Signal } from '@angular/core';
import { merge } from 'rxjs';
import type { AnimeDetail } from '@app/core/services/anilist/anilist.model';
import { AuthService } from '@app/core/services/auth/auth';
import { EpisodeProgressService } from '@app/core/services/episode-progress/episode-progress';
import type {
  EpisodeCommunity,
  EpisodeProgress,
} from '@app/core/services/episode-progress/episode-progress.model';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import type { SeasonDetail, TvShowDetail } from '@app/core/services/tmdb/tmdb.model';
import type { DetailMediaType } from '../data-access/media-detail-view.util';
import { buildSeasonColumns, type RatingSource, type SeasonColumn } from './episode-grid.util';

export const EPISODE_PROVIDER: Partial<Record<DetailMediaType, string>> = {
  tv_show: 'tmdb',
  anime: 'anilist',
};

export function injectEpisodeColumns(sources: {
  mediaType: Signal<DetailMediaType>;
  externalId: Signal<number | string>;
  tvShow: Signal<TvShowDetail | null>;
  animeDetail: Signal<AnimeDetail | null>;
  progress: Signal<EpisodeProgress | null>;
}) {
  const auth = inject(AuthService);
  const tmdb = inject(TmdbService);
  const episodes = inject(EpisodeProgressService);

  const details = signal<ReadonlyMap<number, SeasonDetail>>(new Map());
  const community = signal<EpisodeCommunity | null>(null);

  effect((onCleanup) => {
    const provider = EPISODE_PROVIDER[sources.mediaType()];
    const externalId = String(sources.externalId());
    community.set(null);
    if (!provider || !auth.isAuthenticated()) return;
    const subscription = episodes
      .community(provider, sources.mediaType() as 'tv_show' | 'anime', externalId)
      .subscribe({ next: (c) => community.set(c), error: () => community.set(null) });
    onCleanup(() => subscription.unsubscribe());
  });

  effect((onCleanup) => {
    const show = sources.tvShow();
    details.set(new Map());
    if (!show) return;
    const seasons = show.seasons.filter((s) => s.seasonNumber > 0);
    const subscription = merge(
      ...seasons.map((s) => tmdb.getTvSeason(show.id, s.seasonNumber)),
    ).subscribe({
      next: (detail) => details.update((map) => new Map(map).set(detail.seasonNumber, detail)),
      error: () => undefined,
    });
    onCleanup(() => subscription.unsubscribe());
  });

  const baseProgress = computed<EpisodeProgress>(() => {
    const own = sources.progress();
    if (own) return own;
    const anime = sources.animeDetail();
    return {
      seasons: anime?.episodes
        ? [{ season: 1, total: anime.episodes, watched: [], ratings: {} }]
        : [],
      isCompleted: false,
      status: 'planned',
    };
  });

  const columns = computed<SeasonColumn[]>(() =>
    buildSeasonColumns(baseProgress(), {
      summaries: sources.tvShow()?.seasons ?? [],
      details: details(),
      community: community(),
    }).filter((c) => c.episodes.length > 0),
  );

  const defaultSource = computed<RatingSource>(() => {
    const cells = columns().flatMap((c) => c.episodes);
    if (cells.some((c) => c.mine !== null)) return 'mine';
    if (cells.some((c) => c.tmdb !== null)) return 'tmdb';
    if (cells.some((c) => c.community !== null)) return 'community';
    return 'mine';
  });

  return { columns, details, community, defaultSource };
}
