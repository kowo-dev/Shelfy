import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '@app/core/services/auth/auth';
import type {
  CollectionItemResponse,
  MediaType,
} from '@app/core/services/collection/collection.model';
import { LayoutService } from '@app/core/services/layout/layout';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ButtonComponent } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import type { IconName } from '@shared/ui/icon/icon-registry';
import { BackLinkComponent, type BackTarget } from '@shared/ui/back-link/back-link';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { MEDIA_TYPE_ICON } from '@shared/utils/media-type-icon.util';
import {
  EntityMediaGridComponent,
  entityItemKey,
  type EntityItemFilter,
} from './entity-media-grid';
import {
  EntitySortComponent,
  type EntitySortDirection,
  type EntitySortOption,
} from './entity-sort';

export interface EntityFact {
  value?: string | number | null;
  label: string;
}

interface ShowOption extends TabItem {
  icon: IconName;
}

const WALL_SIZE = 30;
const MEDIA_ORDER: readonly MediaType[] = ['movie', 'tv_show', 'anime', 'manga', 'webtoon', 'game'];

@Component({
  selector: 'shelfy-entity-shelf',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TabsComponent,
    TranslatePipe,
    ButtonComponent,
    IconComponent,
    PageHeroComponent,
    PageFooterComponent,
    BackLinkComponent,
    EntityMediaGridComponent,
    EntitySortComponent,
  ],
  templateUrl: './entity-shelf.html',
  host: { class: 'block h-full min-h-0' },
})
export class EntityShelfComponent {
  private readonly auth = inject(AuthService);
  private readonly layout = inject(LayoutService);
  private readonly translate = inject(TranslateService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  private readonly barSentinel = viewChild<ElementRef<HTMLElement>>('barSentinel');
  readonly stuck = signal(false);

  readonly title = input.required<string>();
  readonly back = input<BackTarget | null>(null);
  readonly leadUrl = input<string | null>(null);
  readonly leadShape = input<'portrait' | 'logo'>('portrait');
  readonly facts = input<readonly EntityFact[]>([]);
  readonly description = input<string | null>(null);
  readonly items = input.required<CollectionItemResponse[]>();
  readonly hasMore = input(false);
  readonly sorts = input<readonly EntitySortOption[]>([]);
  readonly sort = input('');
  readonly direction = input<EntitySortDirection>('desc');
  readonly searchLabel = input('entity.search');

  readonly loadMore = output<void>();
  readonly opened = output<CollectionItemResponse>();
  readonly sortChange = output<string>();
  readonly directionChange = output<EntitySortDirection>();

  readonly show = linkedSignal<string>(() => (this.title(), 'all'));
  readonly query = linkedSignal(() => (this.title(), ''));
  readonly descriptionExpanded = linkedSignal(() => (this.title(), false));
  readonly owned = signal<ReadonlySet<string>>(new Set());

  readonly signedIn = computed(() => !!this.auth.currentUser());
  readonly wall = computed(() => {
    const covers = this.items()
      .map((item) => item.media.coverUrl)
      .filter((url): url is string => !!url);
    if (covers.length === 0) return [];
    return Array.from({ length: WALL_SIZE }, (_, index) => covers[index % covers.length]);
  });
  readonly ownedCount = computed(() => {
    const owned = this.owned();
    return this.items().filter((item) => owned.has(entityItemKey(item))).length;
  });
  readonly totalLabel = computed(() => `${this.items().length}${this.hasMore() ? '+' : ''}`);

  readonly showTabs = computed<TabItem[]>(() =>
    this.showOptions().map((option) => ({
      id: option.id,
      label: option.label,
      count: option.id === 'all' ? this.totalLabel() : option.count,
    })),
  );

  readonly showOptions = computed<ShowOption[]>(() => {
    this.translate.lang();
    const counts = new Map<MediaType, number>();
    for (const item of this.items()) {
      counts.set(item.media.mediaType, (counts.get(item.media.mediaType) ?? 0) + 1);
    }
    const options: ShowOption[] = [
      {
        id: 'all',
        label: this.translate.get('entity.show.all'),
        icon: 'grid',
        count: this.items().length,
      },
    ];
    if (counts.size > 1) {
      for (const type of MEDIA_ORDER) {
        const count = counts.get(type);
        if (!count) continue;
        options.push({
          id: type,
          label: this.translate.get('collection.media_type.' + type),
          icon: MEDIA_TYPE_ICON[type],
          count,
        });
      }
    }
    if (this.signedIn()) {
      options.push({
        id: 'shelf',
        label: this.translate.get('entity.show.shelf'),
        icon: 'shelf',
        count: this.ownedCount(),
      });
    }
    return options;
  });

  readonly hasFilters = computed(() => this.showOptions().length > 1);

  readonly filter = computed<EntityItemFilter>(() => {
    const show = this.show();
    const needle = this.normalize(this.query().trim());
    return (item, owned) => {
      if (show === 'shelf' && !owned) return false;
      if (show !== 'all' && show !== 'shelf' && item.media.mediaType !== show) return false;
      return !needle || this.normalize(item.media.title).includes(needle);
    };
  });
  readonly visibleCount = computed(() => {
    const filter = this.filter();
    const owned = this.owned();
    return this.items().filter((item) => filter(item, owned.has(entityItemKey(item)))).length;
  });

  private readonly watchKey = computed(
    () => `${this.items().length}|${this.show()}|${this.query()}`,
  );

  constructor() {
    this.layout.scrollTop.set(0);
    inject(DestroyRef).onDestroy(() => this.layout.scrollTop.set(0));
    afterRenderEffect((onCleanup) => {
      const watch = this.watchKey();
      const element = this.sentinel()?.nativeElement;
      if (!element || !this.hasMore() || !watch) return;
      const root = this.scrollContainer()?.nativeElement ?? null;
      const reach = Math.round((root?.clientHeight ?? globalThis.innerHeight) * 1.5);
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) this.loadMore.emit();
        },
        { root, rootMargin: `0px 0px ${reach}px 0px` },
      );
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }

  select(id: string): void {
    this.show.set(id);
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

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }
}
