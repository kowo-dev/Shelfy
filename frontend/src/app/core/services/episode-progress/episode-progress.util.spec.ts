import type { EpisodeProgress } from './episode-progress.model';
import { applyEpisodes, nextEpisode, totalCount, watchedCount } from './episode-progress.util';

function progress(seasons: EpisodeProgress['seasons']): EpisodeProgress {
  return { seasons, isCompleted: false, status: 'ongoing' };
}

describe('episode-progress util', () => {
  it('finds the first gap, skipping specials', () => {
    const p = progress([
      { season: 0, total: 2, watched: [], ratings: {} },
      { season: 1, total: 3, watched: [1, 3], ratings: {} },
      { season: 2, total: 3, watched: [], ratings: {} },
    ]);
    expect(nextEpisode(p)).toEqual({ season: 1, episode: 2 });
  });

  it('moves to the next season once one is complete', () => {
    const p = progress([
      { season: 1, total: 2, watched: [1, 2], ratings: {} },
      { season: 2, total: 2, watched: [], ratings: {} },
    ]);
    expect(nextEpisode(p)).toEqual({ season: 2, episode: 1 });
  });

  it('returns null when everything is watched', () => {
    expect(nextEpisode(progress([{ season: 1, total: 1, watched: [1], ratings: {} }]))).toBeNull();
  });

  it('follows the last watched episode when the total is unknown', () => {
    expect(
      nextEpisode(progress([{ season: 1, total: null, watched: [1, 2], ratings: {} }])),
    ).toEqual({
      season: 1,
      episode: 3,
    });
  });

  it('counts watched and total, total null if any season is unknown', () => {
    const p = progress([
      { season: 1, total: 3, watched: [1], ratings: {} },
      { season: 2, total: 2, watched: [1, 2], ratings: {} },
    ]);
    expect(watchedCount(p)).toBe(3);
    expect(totalCount(p)).toBe(5);
    expect(
      totalCount(progress([{ season: 1, total: null, watched: [1], ratings: {} }])),
    ).toBeNull();
  });

  it('applies a toggle locally without touching other seasons', () => {
    const p = progress([
      { season: 1, total: 3, watched: [1], ratings: {} },
      { season: 2, total: 2, watched: [], ratings: {} },
    ]);
    const added = applyEpisodes(p, { season: 1, episodes: [3, 2], isWatched: true });
    expect(added.seasons[0].watched).toEqual([1, 2, 3]);
    expect(added.seasons[1]).toBe(p.seasons[1]);
    const removed = applyEpisodes(added, { season: 1, episodes: [1, 2], isWatched: false });
    expect(removed.seasons[0].watched).toEqual([3]);
  });
});
