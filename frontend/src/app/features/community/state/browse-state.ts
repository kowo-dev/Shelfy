import { computed, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import type { CommunityQuery } from '@app/core/services/community/community.model';
import { ListsService } from '@app/core/services/lists/lists';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { VersusService } from '@app/core/services/versus/versus';
import { createPagedScrollWindow } from '@shared/utils/paged-scroll-window';
import { asCreations, type Creation } from '../data-access/community-stream';
import type { CommunityContext } from './community-context';

const PAGE_SIZE = 24;

export function createBrowseState(
  ctx: CommunityContext,
  options: {
    scrollContainer: () => HTMLElement | null;
    onError: (error: unknown) => void;
    enabled: () => boolean;
  },
) {
  const listsService = inject(ListsService);
  const versusService = inject(VersusService);
  const profiles = inject(UserProfileService);

  const query = (): CommunityQuery => ({
    q: ctx.query(),
    scope: ctx.scope(),
    sort: ctx.sort(),
  });

  const fetchPage = (page: number): Observable<PagedResponse<Creation>> => {
    switch (ctx.view()) {
      case 'lists':
        return listsService
          .browse(page, PAGE_SIZE, query())
          .pipe(map((res) => ({ ...res, content: asCreations.lists(res.content) })));
      case 'versus':
        return versusService
          .browsePools(page, PAGE_SIZE, query())
          .pipe(map((res) => ({ ...res, content: asCreations.versus(res.content) })));
      default:
        return profiles
          .browseReviews(page, PAGE_SIZE, query())
          .pipe(map((res) => ({ ...res, content: asCreations.reviews(res.content) })));
    }
  };

  const window = createPagedScrollWindow<Creation>({
    pageSize: PAGE_SIZE,
    fetchPage,
    scrollContainer: options.scrollContainer,
    onError: options.onError,
    enabled: options.enabled,
  });

  const ended = computed(
    () => !window.loading() && !window.hasMoreDown() && window.items().length > 0,
  );

  return { window, ended };
}
