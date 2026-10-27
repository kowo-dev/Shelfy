import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '@app/core/services/auth/auth';
import { PeopleService } from '@app/core/services/people/people';
import type { FollowedMediaActivity } from '@app/core/services/people/people.model';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import type { EpisodeCell, SeasonColumn } from '../tracker/episode-grid.util';
import { EpisodeSheetComponent } from '../tracker/ui/episode-sheet';
import { EpisodesOverviewComponent } from './episodes-overview/episodes-overview';
import { FriendActivityComponent } from './friend-activity/friend-activity';

const translate = {
  get: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${Object.values(params).join(',')}` : key,
  lang: () => 'en',
};

function cell(episode: number, overrides: Partial<EpisodeCell> = {}): EpisodeCell {
  return {
    season: 1,
    episode,
    title: null,
    overview: null,
    stillPath: null,
    airDate: null,
    runtime: null,
    released: true,
    watched: false,
    mine: null,
    community: null,
    tmdb: null,
    friends: [],
    ...overrides,
  };
}

function season(n: number, watched: number, released: number): SeasonColumn {
  return {
    season: n,
    name: null,
    episodes: Array.from({ length: released }, (_, i) => cell(i + 1, { watched: i < watched })),
    watched,
    released,
    averages: { mine: null, community: null, tmdb: null },
  };
}

describe('EpisodeSheetComponent', () => {
  function render(episode: EpisodeCell) {
    TestBed.configureTestingModule({
      imports: [EpisodeSheetComponent],
      providers: [
        { provide: TmdbService, useValue: { imageUrl: (p: string | null) => p && `img:${p}` } },
        { provide: TranslateService, useValue: translate },
        { provide: DateFormatService, useValue: { formatDate: () => 'January 1, 2020' } },
      ],
    });
    const fixture = TestBed.createComponent(EpisodeSheetComponent);
    fixture.componentRef.setInput('cell', episode);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('joins the air date and the runtime', () => {
    expect(render(cell(1, { airDate: '2020-01-01', runtime: 45 })).facts()).toBe(
      'January 1, 2020 · 45 min',
    );
  });

  it('shows nothing when neither is known', () => {
    expect(render(cell(1)).facts()).toBeNull();
  });

  it('builds the still from the TMDB path', () => {
    expect(render(cell(1, { stillPath: '/s.jpg' })).stillUrl()).toBe('img:/s.jpg');
  });
});

describe('EpisodesOverviewComponent', () => {
  const navigate = vi.fn();

  function render(columns: SeasonColumn[]) {
    TestBed.configureTestingModule({
      imports: [EpisodesOverviewComponent],
      providers: [
        provideRouter([]),
        { provide: TmdbService, useValue: { imageUrl: (p: string | null) => p && `img:${p}` } },
        { provide: TranslateService, useValue: translate },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
    const fixture = TestBed.createComponent(EpisodesOverviewComponent);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('source', 'mine');
    fixture.componentRef.setInput('trackerRoute', ['/media', 'tv_show', '1', 'episodes']);
    fixture.detectChanges();
    return fixture;
  }

  it('opens on the first season with episodes left to watch', () => {
    const columns = [1, 2, 3, 4, 5].map((n) => season(n, n < 4 ? 3 : 0, 3));

    expect(render(columns).componentInstance.season()).toBe(4);
  });

  it('opens on the first season once everything is watched', () => {
    const columns = [1, 2, 3].map((n) => season(n, 3, 3));

    expect(render(columns).componentInstance.season()).toBe(1);
  });

  it('shows one card per episode of the picked season, with season tabs', () => {
    const fixture = render([season(1, 0, 3), season(2, 0, 4)]);
    fixture.componentInstance.season.set(2);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('article')).toHaveLength(4);
    expect(el.querySelector('shelfy-tabs')).not.toBeNull();
  });

  it('drops the season tabs and the controls for a single unshelved season', () => {
    const el: HTMLElement = render([season(1, 0, 3)]).nativeElement;

    expect(el.querySelector('shelfy-tabs')).toBeNull();
    expect(el.querySelector('button[aria-pressed]')).toBeNull();
  });

  it('opens an aired episode in place, not one still to air', () => {
    const overview = render([season(1, 0, 3)]).componentInstance;
    const selected = vi.fn();
    overview.episodeSelected.subscribe(selected);

    overview.open(cell(2, { released: false }));
    overview.open(cell(2));

    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ episode: 2 }));
  });
});

describe('FriendActivityComponent', () => {
  const friend = (username: string, rating: number | null): FollowedMediaActivity => ({
    username,
    displayName: null,
    avatarUrl: null,
    status: 'done',
    rating,
    viewCount: 1,
    updatedAt: '2024-01-01T00:00:00Z',
  });

  function render(friends: FollowedMediaActivity[] | Error, signedIn = true) {
    const onMedia = vi
      .fn()
      .mockReturnValue(friends instanceof Error ? throwError(() => friends) : of(friends));
    TestBed.configureTestingModule({
      imports: [FriendActivityComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: AuthService, useValue: { isAuthenticated: signal(signedIn) } },
        { provide: PeopleService, useValue: { onMedia } },
        { provide: TranslateService, useValue: translate },
      ],
    });
    const fixture = TestBed.createComponent(FriendActivityComponent);
    fixture.componentRef.setInput('provider', 'tmdb');
    fixture.componentRef.setInput('mediaType', 'movie');
    fixture.componentRef.setInput('externalId', '1');
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture, onMedia };
  }

  it('does not ask a guest for friend activity', () => {
    const { component, onMedia } = render([friend('a', 8)], false);

    expect(onMedia).not.toHaveBeenCalled();
    expect(component.friends()).toEqual([]);
  });

  it('averages the ratings of the friends who gave one', () => {
    const { component } = render([friend('a', 8), friend('b', 9), friend('c', null)]);

    expect(component.average()).toBe(8.5);
  });

  it('has no average when nobody rated', () => {
    expect(render([friend('a', null)]).component.average()).toBeNull();
  });

  it('stacks friends who rated first and counts the others as hidden', () => {
    const friends = ['a', 'b', 'c', 'd', 'e', 'f'].map((name, i) =>
      friend(name, i === 5 ? 9 : null),
    );

    const { component } = render(friends);

    expect(component.stacked()).toHaveLength(4);
    expect(component.stacked()[0].username).toBe('f');
    expect(component.hidden()).toBe(2);
  });

  it('names two friends and sums up the rest', () => {
    const { component } = render([friend('a', 8), friend('b', 7), friend('c', 6)]);

    expect(component.names()).toBe('a, b, and media.friend_awards.others:1');
  });

  it('adds how many times a friend saw the title once they came back to it', () => {
    const { component } = render([]);

    expect(component.subline(friend('a', 8))).not.toContain('media.friends.views');
    expect(component.subline({ ...friend('a', 8), viewCount: 3 })).toContain(
      'media.friends.views.watch',
    );
  });

  it('forgets the friends when the request fails', () => {
    expect(render(new Error('boom')).component.friends()).toEqual([]);
  });

  it('closes the sheet when a friend row opens their profile', async () => {
    const { component, fixture } = render([friend('a', 8)]);
    component.sheetOpen.set(true);
    fixture.detectChanges();

    document.querySelector<HTMLAnchorElement>('[role=dialog] a[href="/profile/a"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.sheetOpen()).toBe(false);
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
