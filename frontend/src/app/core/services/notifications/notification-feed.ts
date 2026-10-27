import { computed, inject, Injectable, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ToastService } from '@app/core/services/toast/toast';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { TranslateService } from '@app/core/services/translate/translate';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { NotificationInbox } from './notification-inbox';
import { NotificationsService } from './notifications';
import type { NotificationFamily, NotificationResponse } from './notifications.model';

@Injectable()
export class NotificationFeed {
  private readonly api = inject(NotificationsService);
  private readonly inbox = inject(NotificationInbox);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly confirm = inject(ConfirmService);
  private readonly translate = inject(TranslateService);

  readonly requests = signal<NotificationResponse[]>([]);
  readonly items = signal<NotificationResponse[]>([]);
  readonly family = signal<NotificationFamily | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly busyId = signal<string | null>(null);
  private readonly total = signal(0);
  private page = 0;
  private pageSize = 20;

  readonly hasMore = computed(() => this.items().length < this.total());
  readonly blank = computed(() => this.requests().length === 0 && this.items().length === 0);
  readonly empty = computed(() => !this.loading() && this.blank());
  readonly clearable = computed(() => this.items().length > 0);

  load(pageSize = this.pageSize, loaded?: () => void): void {
    this.pageSize = pageSize;
    this.page = 0;
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      requests: this.api.requests(),
      history: this.api.list(0, pageSize, this.family()),
    }).subscribe({
      next: ({ requests, history }) => {
        this.requests.set(requests);
        this.items.set(history.content);
        this.total.set(history.totalElements);
        this.loading.set(false);
        loaded?.();
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loading.set(true);
    this.api.list(this.page + 1, this.pageSize, this.family()).subscribe({
      next: (history) => {
        this.page += 1;
        const known = new Set(this.items().map((item) => item.id));
        this.items.update((items) => [
          ...items,
          ...history.content.filter((item) => !known.has(item.id)),
        ]);
        this.total.set(history.totalElements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  filter(family: NotificationFamily | null): void {
    if (family === this.family()) return;
    this.family.set(family);
    this.load();
  }

  answer(notification: NotificationResponse, accept: boolean): void {
    this.busyId.set(notification.id);
    this.inbox.answer(notification, accept).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        catchAndToastError(this.toast, this.errorMessage)(error);
      },
    });
  }

  open(notification: NotificationResponse): void {
    this.inbox.markRead(notification);
    const read = (item: NotificationResponse) =>
      item.id === notification.id ? { ...item, isRead: true } : item;
    this.items.update((items) => items.map(read));
    this.requests.update((items) => items.map(read));
  }

  markAllRead(): void {
    this.inbox.markAllRead().subscribe({
      next: () => {
        const read = (item: NotificationResponse) => ({ ...item, isRead: true });
        this.items.update((items) => items.map(read));
        this.requests.update((items) => items.map(read));
      },
      error: catchAndToastError(this.toast, this.errorMessage),
    });
  }

  clear(notification: NotificationResponse): void {
    const before = this.items();
    const total = this.total();
    this.items.set(before.filter((item) => item.id !== notification.id));
    this.total.set(Math.max(0, total - 1));
    this.inbox.clear(notification).subscribe({
      error: (error: unknown) => {
        this.items.set(before);
        this.total.set(total);
        catchAndToastError(this.toast, this.errorMessage)(error);
      },
    });
  }

  async clearAll(): Promise<void> {
    const confirmed = await this.confirm.ask(
      this.translate.get('notifications.clear_all_message'),
      {
        title: this.translate.get('notifications.clear_all_title'),
        confirmLabel: this.translate.get('notifications.clear_all'),
        cancelLabel: this.translate.get('collection.cancel'),
        destructive: true,
      },
    );
    if (!confirmed) return;
    this.inbox.clearAll().subscribe({
      next: () => {
        this.items.set([]);
        this.total.set(0);
      },
      error: catchAndToastError(this.toast, this.errorMessage),
    });
  }
}
