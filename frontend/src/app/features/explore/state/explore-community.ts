import { inject, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
  type Observable,
} from 'rxjs';
import { PeopleService } from '@app/core/services/people/people';
import { ListsService } from '@app/core/services/lists/lists';
import { VersusService } from '@app/core/services/versus/versus';
import { UserProfileService } from '@app/core/services/users/user-profile';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import type { MediaListSummaryResponse } from '@app/core/services/lists/lists.model';
import type { VersusPoolSummaryResponse } from '@app/core/services/versus/versus.model';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import { fromUser, type Connection } from '@app/features/profile-connections/connections';

export const EXPLORE_COMMUNITY_SIZE = 3;

export interface ExploreCommunity {
  people: Connection[];
  lists: MediaListSummaryResponse[];
  versus: VersusPoolSummaryResponse[];
  reviews: ReviewResponse[];
}

export function createExploreCommunity(text: Signal<string>): Signal<ExploreCommunity | null> {
  const people = inject(PeopleService);
  const lists = inject(ListsService);
  const versus = inject(VersusService);
  const profiles = inject(UserProfileService);
  const content = <T>(page$: Observable<PagedResponse<T>>) =>
    page$.pipe(
      map((page) => page.content),
      catchError(() => of([] as T[])),
    );
  return toSignal(
    toObservable(text).pipe(
      map((q) => q.trim()),
      distinctUntilChanged(),
      switchMap((q) => {
        if (!q) return of(null);
        const query = { q };
        return forkJoin({
          people: content(people.search(q, 0, EXPLORE_COMMUNITY_SIZE)).pipe(
            map((users) => users.map(fromUser)),
          ),
          lists: content(lists.browse(0, EXPLORE_COMMUNITY_SIZE, query)),
          versus: content(versus.browsePools(0, EXPLORE_COMMUNITY_SIZE, query)),
          reviews: content(profiles.browseReviews(0, EXPLORE_COMMUNITY_SIZE, query)),
        }).pipe(startWith(null));
      }),
    ),
    { initialValue: null },
  );
}
