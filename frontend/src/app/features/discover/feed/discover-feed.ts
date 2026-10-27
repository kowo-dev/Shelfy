import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, of, type Subscription } from 'rxjs';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { DiscoverService } from '@app/core/services/discover/discover';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { TabsComponent } from '@shared/ui/tabs/tabs';
import { LayoutService } from '@app/core/services/layout/layout';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { todayIsoDate } from '@shared/utils/local-date.util';
import { shortDate } from '../data-access/home-dates';
import {
  HOME_FILTERS,
  isHomeFilter,
  loadFeed,
  releaseDateOf,
  type HomeFilter,
} from '../data-access/home-discovery';
import {
  arrangeFeed,
  FEED_SOURCE,
  feedTypes,
  isFeedKind,
  type FeedKind,
} from '../data-access/home-feed';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';

const FEED_SIZE = 200;
const BATCH = 48;
const WALL = 30;

@Component({
  selector: 'shelfy-discover-feed-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PageHeroComponent,
    PageFooterComponent,
    TabsComponent,
    MediaCardComponent,
  ],
  template: `
    <div
      #scrollContainer
      class="page-scroll h-full min-h-0 [scrollbar-gutter:stable] overflow-x-clip overflow-y-auto [overflow-anchor:none] max-md:pb-(--bottom-nav-clearance)"
      (scroll)="onScroll()"
    >
      <shelfy-page-hero [title]="title()" [wall]="wall()" />

      <div #barSentinel aria-hidden="true"></div>
      <div class="v-libbar" [class.stuck]="stuck()">
        <shelfy-tabs
          class="min-w-0"
          [tabs]="tabs()"
          [activeId]="filter()"
          [label]="'home.filter_label' | translate"
          panelId="feed-panel"
          (tabSelected)="selectFilter($event)"
        />
      </div>

      <div
        id="feed-panel"
        role="tabpanel"
        class="px-gutter mx-auto pt-4.5 pb-35"
        [attr.aria-busy]="loading()"
      >
        @for (shownFilter of [filter()]; track shownFilter) {
          <div class="animate-rise-in motion-reduce:animate-none">
            @if (!loading() && !items().length) {
              <p class="text-text-muted py-16 text-[1.0625rem]">
                {{ 'home.feed_empty' | translate }}
              </p>
            }
            <div class="v-lgrid">
              @for (entry of shown(); track entry.item.id) {
                <shelfy-media-card [item]="entry.item" [subtitle]="entry.subtitle" />
              }
            </div>
          </div>
        }
        <div #sentinel class="h-px" aria-hidden="true"></div>
      </div>
      <shelfy-page-footer />
    </div>
  `,
  host: { class: 'block h-full min-h-0' },
})
export class DiscoverFeedPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly services = {
    discover: inject(DiscoverService),
    tmdb: inject(TmdbService),
    igdb: inject(IgdbService),
  };

  private readonly layout = inject(LayoutService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly barSentinel = viewChild<ElementRef<HTMLElement>>('barSentinel');
  readonly stuck = signal(false);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  readonly kind = computed<FeedKind>(() => {
    const value = this.params().get('feed');
    return isFeedKind(value) ? value : 'trending';
  });

  readonly filter = computed<HomeFilter>(() => {
    const value = this.query().get('type');
    return isHomeFilter(value) ? value : 'all';
  });

  readonly typeQuery = computed(() => {
    const filter = this.filter();
    return filter === 'all' ? {} : { type: filter };
  });

  readonly items = signal<CollectionItemResponse[]>([]);
  readonly loading = signal(true);
  private readonly limit = signal(BATCH);
  private subscription: Subscription | null = null;

  readonly title = computed(() => {
    this.translate.lang();
    return this.translate.get('home.feed.' + this.kind());
  });

  readonly tabs = computed(() => {
    this.translate.lang();
    return HOME_FILTERS.map((id) => ({
      id,
      label: this.translate.get(id === 'all' ? 'home.filter_all' : 'discover.media.' + id),
    }));
  });

  readonly wall = computed(() =>
    this.items()
      .slice(0, WALL)
      .map((item) => item.media.coverUrl!),
  );

  readonly shown = computed(() => {
    const lang = this.translate.lang();
    const today = todayIsoDate();
    const kind = this.kind();
    return this.items()
      .slice(0, this.limit())
      .map((item) => ({ item, subtitle: this.subtitle(kind, item, today, lang) }));
  });

  constructor() {
    this.layout.scrollTop.set(0);
    effect(() => {
      const kind = this.kind();
      const filter = this.filter();
      untracked(() => this.load(kind, filter));
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const target = this.sentinel()?.nativeElement;
      if (!target) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && this.limit() < this.items().length) {
            this.limit.update((value) => value + BATCH);
          }
        },
        { root: this.scrollContainer()?.nativeElement ?? null, rootMargin: '800px 0px' },
      );
      observer.observe(target);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        this.layout.scrollTop.set(0);
        this.subscription?.unsubscribe();
      });
    });
  }

  onScroll(): void {
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

  selectFilter(id: string): void {
    if (!isHomeFilter(id) || id === this.filter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: id === 'all' ? null : id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private load(kind: FeedKind, filter: HomeFilter): void {
    const types = feedTypes(kind, filter);
    this.subscription?.unsubscribe();
    this.limit.set(BATCH);
    this.loading.set(true);
    const lists = types.length
      ? forkJoin(
          types.map((type) =>
            loadFeed(this.services, type, FEED_SOURCE[kind], FEED_SIZE).pipe(
              catchError(() => of([])),
            ),
          ),
        )
      : of([]);
    this.subscription = lists
      .pipe(map((found) => arrangeFeed(kind, found, todayIsoDate())))
      .subscribe((items) => {
        this.items.set(items);
        this.loading.set(false);
      });
  }

  private subtitle(
    kind: FeedKind,
    item: CollectionItemResponse,
    today: string,
    lang: string,
  ): string | null {
    const date = releaseDateOf(item);
    switch (kind) {
      case 'new':
        return date
          ? this.translate.get('home.out_on', { date: shortDate(date, today, lang) })
          : null;
      case 'upcoming':
      case 'soon':
        return date ? shortDate(date, today, lang) : null;
      default:
        return null;
    }
  }
}
