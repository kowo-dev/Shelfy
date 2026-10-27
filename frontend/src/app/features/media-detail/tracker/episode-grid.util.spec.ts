import type { EpisodeProgress } from '@app/core/services/episode-progress/episode-progress.model';
import type { SeasonDetail } from '@app/core/services/tmdb/tmdb.model';
import { buildSeasonColumns, displayScore, seasonAverage, trackerStats } from './episode-grid.util';

const episode = (n: number, airDate: string, voteAverage: number | null = null) => ({
  episodeNumber: n,
  seasonNumber: 1,
  name: `Episode ${n}`,
  overview: '',
  airDate,
  stillPath: null,
  runtime: 45,
  voteAverage,
  voteCount: voteAverage === null ? 0 : 100,
});

const progress: EpisodeProgress = {
  seasons: [
    { season: 0, total: 1, watched: [1], ratings: {} },
    { season: 1, total: 3, watched: [1, 2], ratings: { '1': 9, '2': 6 } },
  ],
  isCompleted: false,
  status: 'ongoing',
};

const season1: SeasonDetail = {
  seasonNumber: 1,
  name: 'Season 1',
  overview: '',
  posterPath: null,
  episodes: [episode(1, '2020-01-01', 8), episode(2, '2020-01-08', 7), episode(3, '2099-01-01')],
};

describe('buildSeasonColumns', () => {
  it('leaves specials out and merges every source per episode', () => {
    const [column, ...rest] = buildSeasonColumns(progress, {
      details: new Map([[1, season1]]),
      community: {
        averages: [{ season: 1, episode: 2, average: 8.5, votes: 4 }],
        following: [
          {
            username: 'ana',
            displayName: null,
            avatarUrl: null,
            ratings: [{ season: 1, episode: 1, rating: 10 }],
          },
        ],
      },
      today: '2026-10-15',
    });

    expect(rest).toEqual([]);
    expect(column.episodes.map((e) => [e.watched, e.released, e.mine])).toEqual([
      [true, true, 9],
      [true, true, 6],
      [false, false, null],
    ]);
    expect(column.episodes[1].community).toEqual({ average: 8.5, votes: 4 });
    expect(column.episodes[0].tmdb).toEqual({ average: 8, votes: 100 });
    expect(column.episodes[0].friends.map((f) => f.rating)).toEqual([10]);
    expect(column.averages.mine).toBe(7.5);
    expect(column.released).toBe(2);
  });

  it('falls back to the progress total when there is no catalog (anime)', () => {
    const [column] = buildSeasonColumns({
      seasons: [{ season: 1, total: 12, watched: [1], ratings: {} }],
      isCompleted: false,
      status: 'ongoing',
    });
    expect(column.episodes).toHaveLength(12);
    expect(column.released).toBe(12);
  });
});

describe('trackerStats', () => {
  it('counts released episodes only and ranks by the chosen source', () => {
    const columns = buildSeasonColumns(progress, {
      details: new Map([[1, season1]]),
      today: '2026-10-15',
    });
    const mine = trackerStats(columns, 'mine');
    expect(mine.watched).toBe(2);
    expect(mine.released).toBe(2);
    expect(mine.percent).toBe(100);
    expect(mine.minutesWatched).toBe(90);
    expect(mine.best?.episode).toBe(1);
    expect(mine.worst?.episode).toBe(2);
    expect(trackerStats(columns, 'tmdb').averages.tmdb).toBe(7.5);
  });
});

describe('displayed scores', () => {
  const columns = buildSeasonColumns(progress, {
    details: new Map([[1, season1]]),
    today: '2026-10-15',
  });
  const [first, second] = columns[0].episodes;

  it('prefers my rating over the external score', () => {
    expect(displayScore(first, 'tmdb')).toBe(9);
    expect(displayScore({ ...second, mine: null }, 'tmdb')).toBe(7);
    expect(displayScore({ ...second, mine: null, tmdb: null }, 'tmdb')).toBeNull();
  });

  it('prefers my season average over the external one', () => {
    expect(seasonAverage(columns[0], 'tmdb')).toBe(7.5);
    expect(
      seasonAverage({ ...columns[0], averages: { mine: null, community: null, tmdb: 7 } }, 'tmdb'),
    ).toBe(7);
  });
});
