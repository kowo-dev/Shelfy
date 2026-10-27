import {
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
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { DiscoverService } from '@app/core/services/discover/discover';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { LayoutService } from '@app/core/services/layout/layout';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import { ExploreCatalogService } from '@app/core/services/search/explore-catalog';
import { SearchService } from '@app/core/services/search/search';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { TabsComponent } from '@shared/ui/tabs/tabs';
import { StartShelfComponent } from '@shared/ui/start-shelf/start-shelf';
import { buildAddTarget } from '@shared/utils/add-target.util';
import { doneVerb, statusLabelKey } from '@shared/utils/collection-status.util';
import { todayIsoDate } from '@shared/utils/local-date.util';
import { createHomeArt } from './data-access/home-art';
import { shortDate } from './data-access/home-dates';
import {
  createHomeDiscovery,
  HOME_FILTERS,
  isHomeFilter,
  releaseDateOf,
  type HomeDiscovery,
  type HomeFilter,
  type HomeSlide,
} from './data-access/home-discovery';
import { createHomeMood, type HomeMood } from './data-access/home-mood';
import { createHomeShelf } from './data-access/home-shelf';
import { HomeAnticipatedComponent } from './ui/home-anticipated/home-anticipated';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import { HomeTileComponent } from './ui/home-tile/home-tile';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { HomeCreationsComponent } from './ui/home-community/home-creations';
import { HomeReviewsComponent } from './ui/home-community/home-reviews';
import { HomeMoodComponent } from './ui/home-mood/home-mood';
import { HomePickComponent } from './ui/home-pick/home-pick';
import { HomeRatedComponent } from './ui/home-rated/home-rated';
import { HomeSoonComponent } from './ui/home-soon/home-soon';
import { HomeStageComponent } from './ui/home-stage/home-stage';
import { HomeTopComponent } from './ui/home-top/home-top';

const FILTER_KEY = 'home.filter';
const LEAVE_MS = 180;
const STAGGER_MS = 70;
const STAGGER_MAX = 5;
const EPISODE_TYPES = new Set<HomeFilter>(['all', 'tv_show', 'anime']);

type HomeSection =
  'continue' | 'pick' | 'anticipated' | 'top' | 'mood' | 'soon' | 'rated' | 'released';

@Component({
  selector: 'shelfy-discover-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TabsComponent,
    PageFooterComponent,
    TranslatePipe,
    RouterLink,
    IconComponent,
    StartShelfComponent,
    HomeAnticipatedComponent,
    MediaCardComponent,
    HomeTileComponent,
    ShelfSectionComponent,
    HomeCreationsComponent,
    HomeReviewsComponent,
    HomeRatedComponent,
    HomeMoodComponent,
    HomePickComponent,
    HomeSoonComponent,
    HomeStageComponent,
    HomeTopComponent,
  ],
  templateUrl: './discover.html',
  host: { class: 'flex-1 min-h-0' },
})
export class DiscoverPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly layout = inject(LayoutService);
  private readonly ambient = inject(AmbientService);
  private readonly storage = inject(LocalStorageService);
  private readonly translate = inject(TranslateService);
  private readonly addSheet = inject(AddSheetService);
  protected readonly itemSheet = inject(ItemSheetService);
  private readonly dateFormat = inject(DateFormatService);
  private readonly catalog = inject(ExploreCatalogService);
  private readonly collection = inject(CollectionService);

  private readonly reduced =
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  protected readonly art = createHomeArt({
    tmdb: inject(TmdbService),
    igdb: inject(IgdbService),
    brightness: (url) => this.ambient.brightnessOf(url),
  });
  private readonly discovery = createHomeDiscovery({
    discover: inject(DiscoverService),
    tmdb: inject(TmdbService),
    igdb: inject(IgdbService),
    art: this.art,
  });
  private readonly moods = createHomeMood({
    search: inject(SearchService),
    art: this.art,
    region: () => this.catalog.region(),
  });
  protected readonly shelf = createHomeShelf();

  private readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  private readonly sentinel = viewChild<ElementRef<HTMLDivElement>>('sentinel');
  private readonly bar = viewChild<ElementRef<HTMLDivElement>>('bar');

  readonly filter = signal<HomeFilter>('all');
  readonly shown = signal<HomeFilter>('all');
  readonly leaving = signal(false);
  readonly stuck = signal(false);
  private readonly content = signal<HomeDiscovery | null>(null);
  private readonly mood = signal<HomeMood | null>(null);
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly tabs = computed(() => {
    this.translate.lang();
    return HOME_FILTERS.map((id) => ({
      id,
      label: this.translate.get(id === 'all' ? 'home.filter_all' : 'discover.media.' + id),
    }));
  });

  readonly typePlural = computed(() => {
    this.translate.lang();
    const filter = this.filter();
    return filter === 'all' ? null : this.translate.get('discover.media_plural.' + filter);
  });

  readonly exploreLabel = computed(() => {
    const plural = this.typePlural();
    return plural
      ? this.translate.get('home.explore_type', { type: plural })
      : this.translate.get('home.explore');
  });

  readonly feedQuery = computed(() => {
    const filter = this.shown();
    return filter === 'all' ? {} : { type: filter };
  });

  libraryQuery(status: 'ongoing' | 'planned') {
    const filter = this.shown();
    return filter === 'all' ? { status } : { status, type: filter };
  }

  readonly exploreQuery = computed(() => {
    const filter = this.filter();
    return filter === 'all' ? {} : { type: filter };
  });

  readonly kicker = computed(() => {
    this.translate.lang();
    return this.translate.get('home.kicker.' + this.filter());
  });

  readonly featured = signal<HomeSlide | null>(null);
  readonly stage = signal<HomeSlide[]>([]);
  readonly wall = signal<string[]>([]);

  readonly view = computed(() => this.content());
  readonly settled = computed(() => {
    const view = this.view();
    return !!view && !view.pending;
  });
  readonly moodView = computed(() => this.mood());

  private readonly matches = (item: CollectionItemResponse, filter: HomeFilter) =>
    filter === 'all' || item.media.mediaType === filter;

  readonly ongoing = computed(() => {
    const filter = this.shown();
    return this.shelf.ongoing().filter((item) => this.matches(item, filter));
  });

  readonly episodes = computed(() => {
    const filter = this.shown();
    if (!EPISODE_TYPES.has(filter)) return [];
    return this.shelf.episodes().filter((episode) => this.matches(episode.item, filter));
  });

  readonly planned = computed(() => {
    const filter = this.shown();
    return this.shelf.planned().filter((item) => this.matches(item, filter));
  });

  readonly released = computed(() => {
    const lang = this.translate.lang();
    const today = todayIsoDate();
    return (this.view()?.released ?? []).map((item) => {
      const date = releaseDateOf(item);
      return {
        item,
        subtitle: date
          ? this.translate.get('home.out_on', { date: shortDate(date, today, lang) })
          : null,
      };
    });
  });

  readonly sections = computed<HomeSection[]>(() => {
    const view = this.view();
    const mood = this.moodView();
    const present: [HomeSection, boolean][] = [
      ['continue', this.ongoing().length > 0],
      ['pick', this.planned().length > 0],
      ['anticipated', (view?.anticipated.length ?? 0) > 0],
      ['top', (view?.top.length ?? 0) > 0],
      ['mood', mood !== null && this.settled()],
      ['rated', (view?.rated.length ?? 0) > 0],
      ['soon', (view?.soon.length ?? 0) > 0],
      ['released', (view?.released.length ?? 0) > 0],
    ];
    return present.filter(([, visible]) => visible).map(([section]) => section);
  });

  readonly empty = computed(
    () => !!this.view() && !this.discovery.loading() && this.sections().length === 0,
  );

  readonly showStart = computed(() => this.shelf.total() === 0);

  readonly moodType = computed(() => {
    this.translate.lang();
    const filter = this.shown();
    return filter === 'all' ? null : this.translate.get('discover.media.' + filter);
  });

  constructor() {
    const initial = [
      this.route.snapshot.queryParamMap.get('type'),
      this.storage.getItem(FILTER_KEY),
    ].find(isHomeFilter);
    if (initial) {
      this.filter.set(initial);
      this.shown.set(initial);
    }
    this.discovery.select(this.filter());
    this.moods.select(this.filter());
    this.syncUrl();

    effect(() => {
      const view = this.discovery.view();
      const shown = this.shown();
      if (view && view.filter === shown) untracked(() => this.content.set(view));
    });

    effect(() => {
      const entry = this.moods.mood();
      const shown = this.shown();
      if (entry && entry.filter === shown) untracked(() => this.mood.set(entry.mood));
    });

    effect(() => {
      const view = this.discovery.view();
      const filter = this.filter();
      if (view && view.filter === filter) {
        untracked(() => {
          this.featured.set(view.featured);
          this.stage.set(view.stage);
          this.wall.set(view.wall);
        });
      }
    });

    this.layout.navOverlay.set(true);
    this.layout.navSolidAt.set(300);
    this.layout.scrollTop.set(0);
    inject(DestroyRef).onDestroy(() => {
      if (this.leaveTimer) clearTimeout(this.leaveTimer);
      this.discovery.dispose();
      this.moods.dispose();
      this.layout.navOverlay.set(false);
      this.layout.scrollTop.set(0);
      void this.ambient.follow(null);
    });
  }

  delay(index: number): number {
    return Math.min(index, STAGGER_MAX) * STAGGER_MS;
  }

  follow(url: string | null): void {
    void this.ambient.follow(url);
  }

  onScroll(): void {
    const container = this.scrollContainer()?.nativeElement;
    this.layout.scrollTop.set(container?.scrollTop ?? 0);
    this.measureStuck();
  }

  selectFilter(id: string): void {
    if (!isHomeFilter(id) || id === this.filter()) return;
    const wasStuck = this.stuck();
    this.filter.set(id);
    this.storage.setItem(FILTER_KEY, id);
    this.syncUrl();
    this.discovery.select(id);
    this.moods.select(id);
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    if (this.reduced) {
      this.shown.set(id);
    } else {
      this.leaving.set(true);
      this.leaveTimer = setTimeout(() => {
        this.leaveTimer = null;
        this.shown.set(id);
        this.leaving.set(false);
      }, LEAVE_MS);
    }
    if (wasStuck) this.scrollToBar();
  }

  since(item: CollectionItemResponse): string {
    return this.translate.get('home.since_short', {
      date: this.dateFormat.formatDate(new Date(item.createdAt), this.translate.lang()),
    });
  }

  readonly finishing = signal<string | null>(null);

  verb(item: CollectionItemResponse): string {
    return doneVerb(item.media.mediaType);
  }

  doneLabel(item: CollectionItemResponse): string {
    return statusLabelKey('done', item.media.mediaType);
  }

  finish(item: CollectionItemResponse): void {
    this.finishing.set(item.id);
    this.collection
      .update(item.id, { status: 'done' })
      .pipe(finalize(() => this.finishing.set(null)))
      .subscribe({ next: (done) => this.itemSheet.open(done), error: () => undefined });
  }

  shelve(item: CollectionItemResponse): void {
    this.addSheet.open(
      buildAddTarget(item, this.translate.get('collection.media_type_one.' + item.media.mediaType)),
    );
  }

  private stickyTop(): number {
    const bar = this.bar()?.nativeElement;
    return bar ? parseFloat(getComputedStyle(bar).top) || 0 : 0;
  }

  private measureStuck(): void {
    const container = this.scrollContainer()?.nativeElement;
    const sentinel = this.sentinel()?.nativeElement;
    if (!container || !sentinel) return;
    const offset = sentinel.getBoundingClientRect().top - container.getBoundingClientRect().top;
    this.stuck.set(offset < this.stickyTop() - 0.5);
  }

  private scrollToBar(): void {
    const container = this.scrollContainer()?.nativeElement;
    const sentinel = this.sentinel()?.nativeElement;
    if (!container || !sentinel) return;
    const top =
      sentinel.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      this.stickyTop();
    container.scrollTo({ top, behavior: this.reduced ? 'auto' : 'smooth' });
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: this.filter() === 'all' ? null : this.filter() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
