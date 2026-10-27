import { inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { FeedService } from '@app/core/services/community/community';
import { FollowsService } from '@app/core/services/follows/follows';

export function createBannerState(signedIn: () => boolean) {
  const follows = inject(FollowsService);
  const feed = inject(FeedService);

  const followingCount = signal<number | null>(null);
  const todayCount = signal<number | null>(null);

  function load(): void {
    if (!signedIn()) return;
    follows
      .following(0, 1)
      .pipe(catchError(() => of(null)))
      .subscribe((page) => followingCount.set(page?.totalElements ?? null));
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    feed
      .unread(startOfDay.toISOString())
      .pipe(catchError(() => of(null)))
      .subscribe((result) => todayCount.set(result?.count ?? null));
  }

  return { followingCount, todayCount, load };
}
