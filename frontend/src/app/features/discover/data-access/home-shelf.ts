import { inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import type {
  CollectionChangeEvent,
  CollectionItemResponse,
  NextEpisodeResponse,
} from '@app/core/services/collection/collection.model';

const CONTINUE_SIZE = 24;
const BACKLOG_SIZE = 40;

export function createHomeShelf() {
  const collection = inject(CollectionService);
  const auth = inject(AuthService);

  const ongoing = signal<CollectionItemResponse[]>([]);
  const planned = signal<CollectionItemResponse[]>([]);
  const episodes = signal<NextEpisodeResponse[]>([]);
  const total = signal<number | null>(null);
  const loaded = signal(false);

  function loadPersonal(): void {
    forkJoin({
      backlog: collection
        .list({
          status: ['planned'],
          size: BACKLOG_SIZE,
          sortBy: 'updatedAt',
          sortDirection: 'desc',
        })
        .pipe(catchError(() => of(null))),
      next: collection.nextEpisodes().pipe(catchError(() => of([]))),
    }).subscribe(({ backlog, next }) => {
      planned.set(backlog?.content ?? []);
      episodes.set(next);
    });
  }

  function load(): void {
    if (!auth.isAuthenticated()) {
      ongoing.set([]);
      planned.set([]);
      episodes.set([]);
      total.set(null);
      loaded.set(true);
      return;
    }
    loadPersonal();
    forkJoin({
      page: collection
        .list({
          status: ['ongoing'],
          size: CONTINUE_SIZE,
          sortBy: 'updatedAt',
          sortDirection: 'desc',
        })
        .pipe(catchError(() => of(null))),
      stats: collection.stats().pipe(catchError(() => of(null))),
    }).subscribe(({ page, stats }) => {
      ongoing.set(page?.content ?? []);
      total.set(stats?.total ?? null);
      loaded.set(true);
    });
  }

  function track(item: CollectionItemResponse): void {
    planned.update((items) => {
      const others = items.filter((known) => known.id !== item.id);
      return item.status === 'planned' ? [item, ...others].slice(0, BACKLOG_SIZE) : others;
    });
  }

  function apply(event: CollectionChangeEvent): void {
    if (event.type === 'created' || event.type === 'updated') track(event.item);
    if (event.type === 'removed') {
      planned.update((items) => items.filter((item) => item.id !== event.id));
    }
    switch (event.type) {
      case 'created':
        total.update((count) => (count === null ? count : count + 1));
        if (event.item.status === 'ongoing') {
          ongoing.update((items) => [event.item, ...items].slice(0, CONTINUE_SIZE));
        }
        return;
      case 'updated': {
        const known = ongoing().some((item) => item.id === event.item.id);
        if (known && event.item.status !== 'ongoing') {
          ongoing.update((items) => items.filter((item) => item.id !== event.item.id));
        } else if (known) {
          ongoing.update((items) =>
            items.map((item) => (item.id === event.item.id ? event.item : item)),
          );
        } else if (event.item.status === 'ongoing') {
          ongoing.update((items) => [event.item, ...items].slice(0, CONTINUE_SIZE));
        }
        return;
      }
      case 'removed':
        total.update((count) => (count === null ? count : Math.max(0, count - 1)));
        ongoing.update((items) => items.filter((item) => item.id !== event.id));
        return;
      default:
        load();
    }
  }

  collection.changes.pipe(takeUntilDestroyed()).subscribe(apply);
  load();

  return {
    ongoing: ongoing.asReadonly(),
    planned: planned.asReadonly(),
    episodes: episodes.asReadonly(),
    total: total.asReadonly(),
    loaded: loaded.asReadonly(),
    reload: load,
  };
}
