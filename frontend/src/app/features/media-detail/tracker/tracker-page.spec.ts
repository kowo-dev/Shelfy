import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import { AniListService } from '@app/core/services/anilist/anilist';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { EpisodeProgressService } from '@app/core/services/episode-progress/episode-progress';
import type { EpisodeProgress } from '@app/core/services/episode-progress/episode-progress.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { TrackerPageComponent } from './tracker-page';

const ITEM = { id: 'ci-1', status: 'ongoing' } as CollectionItemResponse;

function progress(
  watched: number[],
  status: EpisodeProgress['status'] = 'ongoing',
): EpisodeProgress {
  return { seasons: [{ season: 1, total: 3, watched, ratings: {} }], isCompleted: false, status };
}

describe('TrackerPageComponent', () => {
  let episodes: Record<'get' | 'update' | 'rate' | 'markAll', ReturnType<typeof vi.fn>>;
  let collection: Record<'lookup' | 'refreshItem', ReturnType<typeof vi.fn>>;
  let confirm: { ask: ReturnType<typeof vi.fn> };
  let toast: { error: ReturnType<typeof vi.fn> };

  async function setup(mediaType = 'anime', query: Record<string, string> = {}) {
    episodes = {
      get: vi.fn().mockReturnValue(of(progress([1]))),
      update: vi.fn(),
      rate: vi.fn(),
      markAll: vi.fn(),
      community: vi.fn().mockReturnValue(NEVER),
    } as typeof episodes;
    collection = {
      lookup: vi.fn().mockReturnValue(of(ITEM)),
      refreshItem: vi.fn().mockReturnValue(of({ ...ITEM, status: 'done' })),
    };
    confirm = { ask: vi.fn() };
    toast = { error: vi.fn() };
    const aniList = {
      getAnime: vi.fn().mockReturnValue(of({ id: 21, title: 'One Piece', episodes: 3 })),
    };
    TestBed.overrideComponent(TrackerPageComponent, { set: { template: '', imports: [] } });
    TestBed.configureTestingModule({
      imports: [TrackerPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ mediaType, externalId: '21' })),
            queryParamMap: of(convertToParamMap(query)),
          },
        },
        { provide: AuthService, useValue: { isAuthenticated: signal(false) } },
        { provide: TmdbService, useValue: { imageUrl: () => null, getTvShow: vi.fn() } },
        { provide: IgdbService, useValue: { imageUrl: () => null } },
        { provide: AniListService, useValue: aniList },
        { provide: CollectionService, useValue: collection },
        { provide: EpisodeProgressService, useValue: episodes },
        { provide: AddSheetService, useValue: { added: NEVER, open: vi.fn() } },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'failed' } },
        { provide: DateFormatService, useValue: { formatDate: () => '' } },
        {
          provide: TranslateService,
          useValue: { get: (key: string) => key, lang: () => 'en' },
        },
      ],
    });
    const fixture = TestBed.createComponent(TrackerPageComponent);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  const firstSeason = (page: TrackerPageComponent) => page.columns()[0];
  const episode = (page: TrackerPageComponent, n: number) =>
    firstSeason(page).episodes.find((e) => e.episode === n)!;

  it('loads the title, the shelf item and its progress into one season of episodes', async () => {
    const page = await setup();

    expect(collection.lookup).toHaveBeenCalledWith('anilist', 'anime', '21');
    expect(episodes.get).toHaveBeenCalledWith('ci-1');
    expect(page.view().title).toBe('One Piece');
    expect(page.stats()).toMatchObject({ watched: 1, released: 3 });
    expect(page.nextEpisode()?.episode).toBe(2);
  });

  it('does not load anything for a title without episodes', async () => {
    const page = await setup('movie');

    expect(page.trackable()).toBe(false);
    expect(collection.lookup).not.toHaveBeenCalled();
  });

  it('marks an episode at once and keeps the server answer', async () => {
    const page = await setup();
    const answer = new Subject<EpisodeProgress>();
    episodes.update.mockReturnValue(answer);

    page.setWatched(episode(page, 2), true);

    expect(episode(page, 2).watched).toBe(true);
    expect(episodes.update).toHaveBeenCalledWith('ci-1', {
      season: 1,
      episodes: [2],
      isWatched: true,
    });
    answer.next(progress([1, 2]));
    expect(page.progress()).toEqual(progress([1, 2]));
    expect(collection.refreshItem).not.toHaveBeenCalled();
  });

  it('only settles on the answer to the last of several quick changes', async () => {
    const page = await setup();
    const first = new Subject<EpisodeProgress>();
    const second = new Subject<EpisodeProgress>();
    episodes.update.mockReturnValueOnce(first).mockReturnValueOnce(second);

    page.setWatched(episode(page, 2), true);
    page.setWatched(episode(page, 3), true);
    first.next(progress([1, 2]));

    expect(episode(page, 3).watched).toBe(true);
    second.next(progress([1, 2, 3], 'done'));
    expect(page.progress()?.status).toBe('done');
    expect(collection.refreshItem).toHaveBeenCalledWith('ci-1');
  });

  it('reloads the real progress and reports the error when a change fails', async () => {
    const page = await setup();
    episodes.update.mockReturnValue(throwError(() => new Error('boom')));

    page.setWatched(episode(page, 2), true);

    expect(toast.error).toHaveBeenCalledWith('failed');
    expect(episodes.get).toHaveBeenCalledTimes(2);
    expect(episode(page, 2).watched).toBe(false);
  });

  it('rates an episode at once and sends the half-star value', async () => {
    const page = await setup();
    episodes.rate.mockReturnValue(NEVER);

    page.rate(episode(page, 2), 7);

    expect(episode(page, 2).mine).toBe(7);
    expect(episodes.rate).toHaveBeenCalledWith('ci-1', { season: 1, episode: 2, rating: 7 });
  });

  it('averages my ratings when I have some and falls back to the external source otherwise', async () => {
    const page = await setup();

    expect(page.source()).toBe('community');
    expect(page.average()).toEqual({ value: null, mine: false });

    episodes.rate.mockReturnValue(NEVER);
    page.rate(episode(page, 2), 7);
    page.rate(episode(page, 3), 9);

    expect(page.average()).toEqual({ value: 8, mine: true });
    expect(page.stats().best?.episode).toBe(3);
  });

  it('opens the season of the next episode, then follows the chosen season', async () => {
    const page = await setup();

    expect(page.railSeason()?.season).toBe(1);
    page.selectSeason(1);
    expect(page.chosenSeason()).toBe(1);
    expect(page.highlighted()).toBeNull();
  });

  it('titles the season and has no neighbour to step to with a single season', async () => {
    const page = await setup();

    expect(page.seasonTitle()).toBe('media.tracker.season_short');
    expect(page.previousSeason()).toBeNull();
    expect(page.nextSeason()).toBeNull();
  });

  it('opens the season and highlights the episode from the deep link', async () => {
    const page = await setup('anime', { season: '1', episode: '3' });

    expect(page.chosenSeason()).toBe(1);
    expect(page.highlighted()).toBe(3);
    expect(page.selectedKey()).toBeNull();
  });

  it('opens only the season from a season deep link', async () => {
    const page = await setup('anime', { season: '1' });

    expect(page.chosenSeason()).toBe(1);
    expect(page.highlighted()).toBeNull();
  });

  it('opens the episode sheet and steps through the aired episodes', async () => {
    const page = await setup();

    page.selectEpisode(episode(page, 2));
    expect(page.selectedCell()?.episode).toBe(2);
    expect(page.neighbours().previous?.episode).toBe(1);
    page.stepEpisode(1);
    expect(page.selectedCell()?.episode).toBe(3);
    page.stepEpisode(-1);
    expect(page.selectedCell()?.episode).toBe(2);
  });

  it('selects the season and highlights the episode from the best episode', async () => {
    const page = await setup();

    page.focusEpisode(episode(page, 3));

    expect(page.chosenSeason()).toBe(1);
    expect(page.highlighted()).toBe(3);
    page.selectSeason(1);
    expect(page.highlighted()).toBeNull();
    page.goToSeason(1);
    expect(page.highlighted()).toBeNull();
  });

  it('marks the rest of a season, but only released episodes', async () => {
    const page = await setup();
    episodes.update.mockReturnValue(NEVER);

    page.toggleSeason(firstSeason(page));

    expect(episodes.update).toHaveBeenCalledWith('ci-1', {
      season: 1,
      episodes: [1, 2, 3],
      isWatched: true,
    });
  });

  it('asks before clearing everything and stops when the user declines', async () => {
    const page = await setup();
    episodes.get.mockReturnValue(of(progress([1, 2, 3])));
    page.progress.set(progress([1, 2, 3]));
    confirm.ask.mockResolvedValue(false);

    await page.toggleAll();

    expect(confirm.ask).toHaveBeenCalled();
    expect(episodes.markAll).not.toHaveBeenCalled();
  });

  it('marks everything without asking and refreshes the shelf status it changed', async () => {
    const page = await setup();
    episodes.markAll.mockReturnValue(of(progress([1, 2, 3], 'done')));

    await page.toggleAll();

    expect(confirm.ask).not.toHaveBeenCalled();
    expect(episodes.markAll).toHaveBeenCalledWith('ci-1', true);
    expect(page.busy()).toBe(false);
    expect(page.item()?.status).toBe('done');
  });

  it('switches between the ratings grid and a season from the column or tabs', async () => {
    const page = await setup();

    expect(page.activePane()).toBe('s1');
    expect(page.paneTabs().map((tab) => tab.id)).toEqual(['grid', 's1']);

    page.selectPane('grid');
    expect(page.pane()).toBe('grid');
    expect(page.activePane()).toBe('grid');

    page.selectPane('s9');
    expect(page.pane()).toBe('grid');

    page.selectPane('s1');
    expect(page.pane()).toBe('season');
    expect(page.chosenSeason()).toBe(1);
  });

  it('leaves the ratings grid to show the episode picked in it', async () => {
    const page = await setup();
    page.selectPane('grid');

    page.focusEpisode(episode(page, 2));

    expect(page.pane()).toBe('season');
    expect(page.highlighted()).toBe(2);
  });
});
