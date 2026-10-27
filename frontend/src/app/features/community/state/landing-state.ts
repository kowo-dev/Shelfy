import { computed, inject, signal, type Signal } from '@angular/core';
import type { Params } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';
import type { CommunityQuery } from '@app/core/services/community/community.model';
import { FederationService } from '@app/core/services/federation/federation';
import { ListsService } from '@app/core/services/lists/lists';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { VersusService } from '@app/core/services/versus/versus';
import { creationView } from '@shared/ui/creation-card/creation-view';
import { asCreations, type Creation } from '../data-access/community-stream';

const RAIL_SIZE = 12;

interface RailSource {
  id: string;
  titleKey: string;
  query: Params;
  signedInOnly: boolean;
  keepBare?: boolean;
  fetch: () => Observable<Creation[]>;
}

const hasArtwork = (entry: Creation): boolean => {
  if (entry.kind === 'review') {
    const media = entry.review.media;
    return !!media.coverUrl && !media.isAdult;
  }
  const view = creationView(entry.kind === 'list' ? { list: entry.list } : { pool: entry.pool });
  if (!view) return false;
  const minimum = entry.kind === 'versus' ? 2 : 1;
  return view.covers.length >= minimum && view.covers.every((cover) => cover.url && !cover.adult);
};

const edited = (entry: Creation): string =>
  entry.kind === 'list'
    ? entry.list.updatedAt
    : entry.kind === 'versus'
      ? entry.pool.updatedAt
      : '';

export interface LandingRail {
  id: string;
  titleKey: string;
  query: Params;
  items: Creation[];
}

export function createLandingState(signedIn: Signal<boolean>) {
  const profiles = inject(UserProfileService);
  const lists = inject(ListsService);
  const versus = inject(VersusService);
  const federation = inject(FederationService);

  const reviews = (query: CommunityQuery) => () =>
    profiles
      .browseReviews(0, RAIL_SIZE, query)
      .pipe(map((page) => asCreations.reviews(page.content)));

  const sources: RailSource[] = [
    {
      id: 'mine',
      titleKey: 'community.landing.mine',
      query: { f: 'lists', scope: 'MINE' },
      signedInOnly: true,
      keepBare: true,
      fetch: () =>
        forkJoin([
          lists.browse(0, RAIL_SIZE, { scope: 'MINE', sort: 'RECENT' }),
          versus.browsePools(0, RAIL_SIZE, { scope: 'MINE', sort: 'RECENT' }),
        ]).pipe(
          map(([listPage, poolPage]) =>
            [...asCreations.lists(listPage.content), ...asCreations.versus(poolPage.content)].sort(
              (a, b) => Date.parse(edited(b)) - Date.parse(edited(a)),
            ),
          ),
        ),
    },
    {
      id: 'popular-reviews',
      titleKey: 'community.landing.popular_reviews',
      query: { f: 'reviews', sort: 'POPULAR' },
      signedInOnly: false,
      fetch: reviews({ scope: 'ALL', sort: 'POPULAR' }),
    },
    {
      id: 'friends-reviews',
      titleKey: 'community.landing.friends_reviews',
      query: { f: 'reviews', scope: 'CIRCLE' },
      signedInOnly: true,
      fetch: reviews({ scope: 'CIRCLE', sort: 'RECENT' }),
    },
    {
      id: 'popular-lists',
      titleKey: 'community.landing.popular_lists',
      query: { f: 'lists', sort: 'POPULAR' },
      signedInOnly: false,
      fetch: () =>
        lists
          .browse(0, RAIL_SIZE, { scope: 'ALL', sort: 'POPULAR' })
          .pipe(map((page) => asCreations.lists(page.content))),
    },
    {
      id: 'popular-versus',
      titleKey: 'community.landing.popular_versus',
      query: { f: 'versus', sort: 'POPULAR' },
      signedInOnly: false,
      fetch: () =>
        versus
          .browsePools(0, RAIL_SIZE, { scope: 'ALL', sort: 'POPULAR' })
          .pipe(map((page) => asCreations.versus(page.content))),
    },
    {
      id: 'remote-reviews',
      titleKey: 'community.landing.remote_reviews',
      query: { f: 'reviews', scope: 'REMOTE' },
      signedInOnly: true,
      fetch: () =>
        federation
          .enabled()
          .pipe(
            switchMap((enabled) =>
              enabled ? reviews({ scope: 'REMOTE', sort: 'RECENT' })() : of([]),
            ),
          ),
    },
  ];

  const loaded = signal<Record<string, Creation[]>>({});
  const requested = signal<ReadonlySet<string>>(new Set());
  const pending = signal(0);

  const rails = computed<LandingRail[]>(() => {
    const done = loaded();
    const asked = requested();
    const shown: LandingRail[] = [];
    for (const { id, titleKey, query } of sources) {
      if (!asked.has(id)) continue;
      const items = done[id];
      if (!items) break;
      if (items.length) shown.push({ id, titleKey, query, items });
    }
    return shown;
  });
  const loading = computed(() => pending() > 0 && rails().length === 0);

  function load(): void {
    for (const source of sources) {
      if (requested().has(source.id) || (source.signedInOnly && !signedIn())) continue;
      requested.update((ids) => new Set(ids).add(source.id));
      pending.update((count) => count + 1);
      source
        .fetch()
        .pipe(catchError(() => of([] as Creation[])))
        .subscribe((items) => {
          pending.update((count) => count - 1);
          loaded.update((all) => ({
            ...all,
            [source.id]: source.keepBare ? items : items.filter(hasArtwork),
          }));
        });
    }
  }

  return { rails, loading, load };
}
