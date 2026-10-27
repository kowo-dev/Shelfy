import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { LayoutService } from '@app/core/services/layout/layout';
import { NotificationFeed } from '@app/core/services/notifications/notification-feed';
import { NotificationInbox } from '@app/core/services/notifications/notification-inbox';
import type { NotificationFamily } from '@app/core/services/notifications/notifications.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { groupByAge } from '@shared/ui/notification-row/notification-copy';
import { NotificationRowComponent } from '@shared/ui/notification-row/notification-row';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { createPosterWall } from '@shared/utils/poster-wall.util';
import { observeLoadMore } from '@shared/utils/scroll-observers';

const FILTERS: readonly NotificationFamily[] = [
  'RELATIONS',
  'COMMENTS',
  'LIKES',
  'COLLABORATION',
  'FEDIVERSE',
];

@Component({
  selector: 'shelfy-notifications-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IconComponent,
    NotificationRowComponent,
    PageHeroComponent,
    PageFooterComponent,
    SpinnerComponent,
    TabsComponent,
  ],
  providers: [NotificationFeed],
  templateUrl: './notifications.html',
})
export class NotificationsPageComponent {
  protected readonly feed = inject(NotificationFeed);
  protected readonly inbox = inject(NotificationInbox);
  private readonly auth = inject(AuthService);
  private readonly layout = inject(LayoutService);
  private readonly translate = inject(TranslateService);
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly barSentinel = viewChild<ElementRef<HTMLElement>>('barSentinel');
  protected readonly stuck = signal(false);

  protected readonly sectionTitle =
    'font-display text-text mb-4 flex items-baseline gap-2 text-[1.5rem] leading-[1.05] font-extrabold tracking-[-0.04em]';
  protected readonly emptyTitle =
    'font-display text-text text-[1.75rem] font-extrabold tracking-[-0.04em]';
  protected readonly secondaryButton = buttonClasses({ variant: 'secondary', extraClass: 'mt-2' });
  protected readonly skeletonSlots = [0, 1, 2, 3, 4, 5];

  protected readonly wall = createPosterWall();
  protected readonly active = computed(() => this.feed.family() ?? 'all');
  protected readonly groups = computed(() => groupByAge(this.feed.items()));
  protected readonly empty = computed(
    () =>
      !this.feed.loading() &&
      this.feed.items().length === 0 &&
      (this.feed.family() !== null || this.feed.requests().length === 0),
  );

  protected readonly tabs = computed<TabItem[]>(() => {
    this.translate.lang();
    const families = this.auth.currentUser()?.isAdmin
      ? [...FILTERS, 'MODERATION' as const]
      : FILTERS;
    const summary = this.inbox.summary();
    const dot = (unread: number | undefined) => (unread ? 'var(--color-text)' : null);
    const dotLabel = this.translate.get('notifications.unread_label');
    return [
      {
        id: 'all',
        label: this.translate.get('notifications.filters.all'),
        count: summary.all,
        dot: dot(summary.total),
        dotLabel,
      },
      ...families.map((family) => ({
        id: family,
        label: this.translate.get(`notifications.filters.${family}`),
        count: summary.totals[family] ?? 0,
        dot: dot(summary.families[family]),
        dotLabel,
      })),
    ];
  });

  constructor() {
    this.wall.load();
    this.feed.load();
    observeLoadMore(this.sentinel, () => this.feed.loadMore(), this.scrollContainer);
    this.layout.scrollTop.set(0);
    inject(DestroyRef).onDestroy(() => this.layout.scrollTop.set(0));
  }

  protected select(id: string): void {
    this.feed.filter(id === 'all' ? null : (id as NotificationFamily));
  }

  protected onScroll(): void {
    const el = this.scrollContainer()?.nativeElement;
    this.layout.scrollTop.set(el?.scrollTop ?? 0);
    const sentinel = this.barSentinel()?.nativeElement;
    if (!el || !sentinel) return;
    const top = sentinel.getBoundingClientRect().top - el.getBoundingClientRect().top;
    const nav =
      window.innerWidth >= 768
        ? parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-height'),
          ) || 76
        : 0;
    this.stuck.set(top < nav - 0.5);
  }
}
