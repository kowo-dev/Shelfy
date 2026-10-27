import type { MediaType, UserMediaStatus } from '@app/core/services/collection/collection.model';
import type { EpisodeProgress } from '@app/core/services/episode-progress/episode-progress.model';
import { doneVerb } from '@shared/utils/collection-status.util';

export interface NextEpisode {
  season: number;
  number: number;
  watched: number;
  total: number;
  multi: boolean;
}

export type NextAction = 'shelve' | 'start' | 'resume' | 'episode' | 'finish';

export function isEpisodic(mediaType: MediaType): boolean {
  return mediaType === 'tv_show' || mediaType === 'anime';
}

export function nextEpisode(progress: EpisodeProgress | null): NextEpisode | null {
  const seasons = (progress?.seasons ?? [])
    .filter((s) => s.season > 0 && (s.total ?? 0) > 0)
    .sort((a, b) => a.season - b.season);
  for (const season of seasons) {
    const watched = new Set(season.watched);
    const total = season.total ?? 0;
    for (let number = 1; number <= total; number++) {
      if (!watched.has(number)) {
        return {
          season: season.season,
          number,
          watched: season.watched.length,
          total,
          multi: seasons.length > 1,
        };
      }
    }
  }
  return null;
}

export function nextAction(
  status: UserMediaStatus | null,
  episodic: boolean,
  next: NextEpisode | null,
): NextAction | null {
  switch (status) {
    case null:
      return 'shelve';
    case 'planned':
      return 'start';
    case 'dropped':
      return 'resume';
    case 'done':
      return null;
    default:
      return episodic && next ? 'episode' : 'finish';
  }
}

export function nextActionLabel(
  action: NextAction | null,
  mediaType: MediaType,
  next: NextEpisode | null,
  translate: (key: string, params?: Record<string, string | number>) => string,
): string {
  const verb = doneVerb(mediaType);
  switch (action) {
    case 'shelve':
      return translate('home.cta.shelve');
    case 'start':
      return translate('home.cta.start.' + verb);
    case 'resume':
      return translate('home.cta.resume');
    case 'episode':
      return next?.multi
        ? translate('home.cta.mark_episode', { code: `S${next.season}E${next.number}` })
        : translate('home.cta.mark_single', { number: next?.number ?? '' });
    case 'finish':
      return translate('home.cta.done.' + verb);
    default:
      return '';
  }
}

export function nextActionIcon(action: NextAction | null): string {
  if (action === 'shelve') return 'bookmarks';
  if (action === 'start' || action === 'resume') return 'play';
  return 'checkCircle';
}
