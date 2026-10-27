import type { EpisodeProgress } from '@app/core/services/episode-progress/episode-progress.model';
import { nextAction, nextActionLabel, nextEpisode } from './next-action.util';

const progress = (seasons: EpisodeProgress['seasons']): EpisodeProgress => ({
  seasons,
  isCompleted: false,
  status: 'ongoing',
});

describe('next action util', () => {
  it('finds the first unwatched episode across seasons, skipping specials', () => {
    const next = nextEpisode(
      progress([
        { season: 0, total: 3, watched: [], ratings: {} },
        { season: 2, total: 4, watched: [1], ratings: {} },
        { season: 1, total: 2, watched: [1, 2], ratings: {} },
      ]),
    );

    expect(next).toEqual({ season: 2, number: 2, watched: 1, total: 4, multi: true });
    expect(
      nextEpisode(progress([{ season: 1, total: 2, watched: [1, 2], ratings: {} }])),
    ).toBeNull();
    expect(nextEpisode(null)).toBeNull();
  });

  it('picks the action from the status, then the episodes', () => {
    const next = { season: 1, number: 3, watched: 2, total: 8, multi: false };

    expect(nextAction(null, true, null)).toBe('shelve');
    expect(nextAction('planned', true, null)).toBe('start');
    expect(nextAction('dropped', false, null)).toBe('resume');
    expect(nextAction('ongoing', true, next)).toBe('episode');
    expect(nextAction('ongoing', true, null)).toBe('finish');
    expect(nextAction('ongoing', false, next)).toBe('finish');
    expect(nextAction('done', true, next)).toBeNull();
  });

  it('words the action with the verb of the media type', () => {
    const t = (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key;

    expect(nextActionLabel('start', 'game', null, t)).toBe('home.cta.start.played');
    expect(nextActionLabel('finish', 'book', null, t)).toBe('home.cta.done.read');
    expect(
      nextActionLabel(
        'episode',
        'tv_show',
        { season: 3, number: 8, watched: 7, total: 13, multi: true },
        t,
      ),
    ).toBe('home.cta.mark_episode:S3E8');
  });
});
