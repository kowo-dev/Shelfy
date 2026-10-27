import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { map, tap, type Observable } from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import { ListsService } from '@app/core/services/lists/lists';
import { VersusService } from '@app/core/services/versus/versus';
import { NotificationsService } from './notifications';
import type { NotificationResponse, NotificationSummary } from './notifications.model';

const POLL_MS = 60_000;
const EMPTY: NotificationSummary = { total: 0, personal: 0, families: {}, all: 0, totals: {} };

@Injectable({ providedIn: 'root' })
export class NotificationInbox {
  private readonly api = inject(NotificationsService);
  private readonly auth = inject(AuthService);
  private readonly lists = inject(ListsService);
  private readonly versus = inject(VersusService);
  private readonly document = inject(DOCUMENT);

  private readonly summarySignal = signal<NotificationSummary>(EMPTY);
  readonly summary = this.summarySignal.asReadonly();
  readonly unread = computed(() => this.summarySignal().total);
  readonly personal = computed(() => this.summarySignal().personal);
  readonly hasUnread = computed(() => this.summarySignal().total > 0);
  readonly badge = computed(() => {
    const personal = this.summarySignal().personal;
    return personal === 0 ? null : personal > 9 ? '9+' : String(personal);
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const onResume = (): void => {
      if (this.document.visibilityState === 'visible') this.refresh();
    };
    this.document.addEventListener('visibilitychange', onResume);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onResume);
      this.stop();
    });

    effect(() => {
      const signedIn = this.auth.isAuthenticated();
      this.api.changes();
      untracked(() => {
        if (signedIn) {
          this.start();
          this.refresh();
        } else {
          this.stop();
          this.summarySignal.set(EMPTY);
        }
      });
    });
  }

  refresh(): void {
    if (!this.auth.isAuthenticated()) return;
    this.api.summary().subscribe({
      next: (summary) => this.summarySignal.set(summary),
      error: () => undefined,
    });
  }

  answer(notification: NotificationResponse, accept: boolean): Observable<void> {
    const id = notification.targetId ?? '';
    const call: Observable<unknown> = (() => {
      switch (notification.type) {
        case 'LIST_COLLABORATION_INVITE':
          return accept
            ? this.lists.acceptCollaboratorInvite(id)
            : this.lists.declineCollaboratorInvite(id);
        default:
          return accept
            ? this.versus.acceptCollaboratorInvite(id)
            : this.versus.declineCollaboratorInvite(id);
      }
    })();
    return call.pipe(
      map(() => undefined),
      tap(() => this.refresh()),
    );
  }

  markRead(notification: NotificationResponse): void {
    if (notification.isRead) return;
    this.api.markRead(notification.id).subscribe({ error: () => this.refresh() });
  }

  markAllRead(): Observable<void> {
    return this.api.markAllRead().pipe(
      tap(() =>
        this.summarySignal.update((summary) => ({
          ...summary,
          total: 0,
          personal: 0,
          families: {},
        })),
      ),
    );
  }

  clear(notification: NotificationResponse): Observable<void> {
    return this.api.clear(notification.id).pipe(tap(() => this.refresh()));
  }

  clearAll(): Observable<void> {
    return this.api.clearAll().pipe(tap(() => this.refresh()));
  }

  private start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      if (this.document.visibilityState === 'visible') this.refresh();
    }, POLL_MS);
  }

  private stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
