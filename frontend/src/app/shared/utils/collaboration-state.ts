import { computed, inject, signal, type Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  filter,
  map,
  of,
  Subject,
  switchMap,
  type Observable,
} from 'rxjs';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { FollowsService, type FollowUserResponse } from '@app/core/services/follows/follows';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import type { CollaboratorMember } from '@shared/ui/collaborators-sheet/collaborators-sheet';
import { catchAndToastError } from './catch-and-toast-error.util';

export interface CollaborationTarget {
  id: string;
  userId: string;
  collaborators: readonly CollaboratorMember[];
  pendingInvites: readonly CollaboratorMember[];
}

export interface CollaborationApi {
  invite(id: string, userId: string): Observable<unknown>;
  accept(id: string): Observable<unknown>;
  decline(id: string): Observable<unknown>;
  remove(id: string, userId: string): Observable<unknown>;
}

export function createCollaborationState(options: {
  target: Signal<CollaborationTarget | null>;
  viewerId: Signal<string | null>;
  api: CollaborationApi;
  changed: () => void;
  gone: () => void;
}) {
  const follows = inject(FollowsService);
  const toast = inject(ToastService);
  const translate = inject(TranslateService);
  const onError = catchAndToastError(toast, inject(ErrorMessageService));

  const open = signal(false);
  const followers = signal<FollowUserResponse[]>([]);
  const busyUserId = signal<string | null>(null);
  const answering = signal(false);

  const isOwner = computed(() => {
    const target = options.target();
    return !!target && target.userId === options.viewerId();
  });

  const candidates = computed(() => {
    const target = options.target();
    if (!target) return [];
    const taken = new Set([
      target.userId,
      ...target.collaborators.map((member) => member.userId),
      ...target.pendingInvites.map((member) => member.userId),
    ]);
    return followers().filter((person) => !taken.has(person.id));
  });

  function run(
    request: Observable<unknown>,
    successKey: string,
    after: () => void,
    done: () => void,
  ): void {
    request.subscribe({
      next: () => {
        done();
        toast.success(translate.get(successKey));
        after();
      },
      error: (error: unknown) => {
        done();
        onError(error);
      },
    });
  }

  let fetchedQuery = '';
  const queries = new Subject<string>();
  queries
    .pipe(
      debounceTime(250),
      map((query) => query.trim()),
      filter((query) => query !== fetchedQuery),
      switchMap((query) => {
        fetchedQuery = query;
        return follows.followers(0, 50, query).pipe(
          catchError((error: unknown) => {
            onError(error);
            return of(null);
          }),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe((page) => page && followers.set(page.content));

  function show(): void {
    open.set(true);
    if (!isOwner()) return;
    fetchedQuery = '';
    follows.followers(0, 50).subscribe({
      next: (page) => followers.set(page.content),
      error: onError,
    });
  }

  function invite(person: FollowUserResponse): void {
    const target = options.target();
    if (!target || busyUserId()) return;
    busyUserId.set(person.id);
    run(
      options.api.invite(target.id, person.id),
      'lists.collab.invite_sent',
      () => {
        followers.update((items) => items.filter((item) => item.id !== person.id));
        options.changed();
      },
      () => busyUserId.set(null),
    );
  }

  function remove(userId: string, successKey = 'lists.collab.removed'): void {
    const target = options.target();
    if (!target || busyUserId()) return;
    busyUserId.set(userId);
    run(options.api.remove(target.id, userId), successKey, options.changed, () =>
      busyUserId.set(null),
    );
  }

  function accept(): void {
    const target = options.target();
    if (!target || answering()) return;
    answering.set(true);
    run(options.api.accept(target.id), 'lists.collab.accepted', options.changed, () =>
      answering.set(false),
    );
  }

  function decline(): void {
    const target = options.target();
    if (!target || answering()) return;
    answering.set(true);
    run(options.api.decline(target.id), 'lists.collab.declined', options.gone, () =>
      answering.set(false),
    );
  }

  function leave(): void {
    const target = options.target();
    const viewerId = options.viewerId();
    if (!target || !viewerId || busyUserId()) return;
    busyUserId.set(viewerId);
    run(options.api.remove(target.id, viewerId), 'lists.collab.left', options.gone, () =>
      busyUserId.set(null),
    );
  }

  return {
    open,
    candidates,
    busyUserId,
    answering,
    isOwner,
    show,
    search: (query: string) => queries.next(query),
    invite,
    remove,
    cancelInvite: (userId: string) => remove(userId, 'lists.collab.invite_cancelled'),
    accept,
    decline,
    leave,
  };
}
