import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { AddSheetService } from '@app/core/services/add-sheet/add-sheet';
import { AniListService } from '@app/core/services/anilist/anilist';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { EpisodeProgressService } from '@app/core/services/episode-progress/episode-progress';
import type { EpisodeProgress } from '@app/core/services/episode-progress/episode-progress.model';
import {
  applyEpisodes,
  applyRating,
} from '@app/core/services/episode-progress/episode-progress.util';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { LayoutService } from '@app/core/services/layout/layout';
import { buttonClasses } from '@shared/ui/button/button';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state';
import { IconComponent } from '@shared/ui/icon/icon';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { RatingValueComponent } from '@shared/ui/rating-value/rating-value';
import { EXTERNAL_RATING_COLOR, ratingColor } from '@shared/utils/collection-rating.util';
import { createMediaDetailPage } from '../data-access/media-detail-page';
import { buildMediaDetailView, type DetailMediaType } from '../data-access/media-detail-view.util';
import { EPISODE_PROVIDER, injectEpisodeColumns } from './episode-columns';
import {
  externalSource,
  releasedNeighbours,
  trackerStats,
  type EpisodeCell,
  type SeasonColumn,
} from './episode-grid.util';
import { EpisodeSheetComponent } from './ui/episode-sheet';
import { RatingMatrixComponent, SEASON_ARROW } from './ui/rating-matrix';
import { SeasonListComponent } from './ui/season-list';

@Component({
  selector: 'shelfy-tracker-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateComponent,
    EpisodeSheetComponent,
    IconComponent,
    PageHeroComponent,
    RatingValueComponent,
    RatingMatrixComponent,
    SeasonListComponent,
    SpinnerComponent,
    TabsComponent,
    TranslatePipe,
  ],
  templateUrl: './tracker-page.html',
})
export class TrackerPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly documentTitle = inject(Title);
  private readonly auth = inject(AuthService);
  private readonly tmdb = inject(TmdbService);
  private readonly igdb = inject(IgdbService);
  private readonly collection = inject(CollectionService);
  private readonly episodes = inject(EpisodeProgressService);
  private readonly translate = inject(TranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly addSheet = inject(AddSheetService);
  private readonly layout = inject(LayoutService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly barSentinel = viewChild<ElementRef<HTMLElement>>('barSentinel');
  readonly stuck = signal(false);
  private readonly toastError = catchAndToastError(
    inject(ToastService),
    inject(ErrorMessageService),
  );

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly mediaType = computed(() => this.params().get('mediaType') as DetailMediaType);
  readonly externalId = computed(() => {
    const raw = this.params().get('externalId') ?? '';
    return this.mediaType() === 'tv_show' || this.mediaType() === 'anime' ? Number(raw) : raw;
  });
  readonly trackable = computed(() => !!EPISODE_PROVIDER[this.mediaType()]);

  readonly loadFailed = signal(false);
  private readonly page = createMediaDetailPage(
    (error) => {
      this.loadFailed.set(true);
      this.toastError(error);
    },
    {
      tmdb: this.tmdb,
      igdb: this.igdb,
      aniList: inject(AniListService),
      collectionService: this.collection,
    },
  );
  readonly loading = this.page.loading;
  readonly item = computed(() => {
    return this.page.collectionItem();
  });
  readonly view = computed(() =>
    buildMediaDetailView(
      this.mediaType(),
      {
        movie: null,
        tvShow: this.page.tvShow(),
        game: null,
        animeDetail: this.page.animeDetail(),
        mangaDetail: null,
      },
      { tmdb: this.tmdb, igdb: this.igdb },
    ),
  );

  readonly progress = signal<EpisodeProgress | null>(null);
  readonly busy = signal(false);
  private pending = 0;

  private readonly episodeData = injectEpisodeColumns({
    mediaType: this.mediaType,
    externalId: this.externalId,
    tvShow: this.page.tvShow,
    animeDetail: this.page.animeDetail,
    progress: this.progress,
  });
  readonly columns = this.episodeData.columns;

  readonly source = computed(() => externalSource(this.columns()));

  readonly stats = computed(() => trackerStats(this.columns(), this.episodeData.defaultSource()));
  readonly average = computed(() => {
    const { averages } = this.stats();
    const mine = averages.mine !== null;
    return { value: averages.mine ?? averages[this.source()], mine };
  });

  private readonly currentSeason = computed(() => {
    const columns = this.columns();
    const inProgress = columns.find((c) => c.released > c.watched);
    return (
      (inProgress ?? [...columns].reverse().find((c) => c.released > 0) ?? columns[0])?.season ??
      null
    );
  });

  readonly chosenSeason = signal<number | null>(null);
  readonly pane = signal<'grid' | 'season'>('season');
  readonly railSeason = computed(() => {
    const wanted = this.chosenSeason() ?? this.currentSeason();
    return this.columns().find((c) => c.season === wanted) ?? this.columns()[0] ?? null;
  });
  private readonly seasonIndex = computed(() =>
    this.columns().findIndex((c) => c.season === this.railSeason().season),
  );
  readonly previousSeason = computed(() => this.columns()[this.seasonIndex() - 1] ?? null);
  readonly nextSeason = computed(() => this.columns()[this.seasonIndex() + 1] ?? null);
  readonly seasonTitle = computed(() => {
    this.translate.lang();
    return this.translate.get('media.tracker.season_short', { season: this.railSeason().season });
  });
  readonly seasonArrow = SEASON_ARROW;
  readonly activePane = computed(() =>
    this.pane() === 'grid' ? 'grid' : `s${this.railSeason()?.season ?? ''}`,
  );
  readonly paneTabs = computed<TabItem[]>(() => {
    this.translate.lang();
    return [
      { id: 'grid', label: this.translate.get('media.tracker.ratings_short') },
      ...this.columns().map((column, index) => ({
        id: `s${column.season}`,
        label: this.translate.get('media.tracker.season_short', { season: column.season }),
        count: `${column.watched}/${column.released}`,
        separated: index === 0,
      })),
    ];
  });

  readonly heroPrimary = buttonClasses({ variant: 'primary', extraClass: 'gap-2.5' });
  readonly heroChip = buttonClasses({ variant: 'secondary', extraClass: 'gap-2.5' });
  readonly sectionTitle =
    'font-display text-text text-[clamp(1.875rem,2.6vw,2.625rem)] leading-none font-extrabold tracking-[-0.05em]';
  readonly headerRow = 'flex min-h-16.5 items-center gap-4 py-3';

  readonly nextEpisode = computed(
    () =>
      this.columns()
        .flatMap((c) => c.episodes)
        .find((e) => e.released && !e.watched) ?? null,
  );
  readonly highlighted = signal<number | null>(null);

  selectSeason(season: number): void {
    this.pane.set('season');
    this.chosenSeason.set(season);
    this.highlighted.set(null);
  }

  selectPane(id: string): void {
    if (id === 'grid') {
      this.pane.set('grid');
      return;
    }
    const season = Number(id.slice(1));
    if (this.columns().some((column) => column.season === season)) this.selectSeason(season);
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

  goToSeason(season: number): void {
    this.selectSeason(season);
    this.scrollToEpisodes();
  }

  focusEpisode(cell: EpisodeCell): void {
    this.pane.set('season');
    this.chosenSeason.set(cell.season);
    this.highlighted.set(cell.episode);
  }

  private scrollToEpisodes(): void {
    if (globalThis.matchMedia?.('(min-width: 64rem)')?.matches) return;
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    setTimeout(() =>
      document
        .getElementById('tracker-episodes')
        ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }),
    );
  }

  readonly selectedKey = signal<string | null>(null);
  readonly selectedCell = computed(() => {
    const key = this.selectedKey();
    if (!key) return null;
    const [season, episode] = key.split(':').map(Number);
    return (
      this.columns()
        .find((c) => c.season === season)
        ?.episodes.find((e) => e.episode === episode) ?? null
    );
  });

  readonly secondaryPill = buttonClasses({ variant: 'secondary' });
  readonly primaryPill = buttonClasses({ variant: 'primary' });

  constructor() {
    this.layout.scrollTop.set(0);
    inject(DestroyRef).onDestroy(() => this.layout.scrollTop.set(0));
    this.addSheet.added.pipe(takeUntilDestroyed()).subscribe((item) => {
      if (item.media.externalId === String(this.externalId())) this.page.collectionItem.set(item);
    });

    effect(() => {
      this.loadFailed.set(false);
      if (this.trackable()) this.page.load(this.mediaType(), this.externalId());
    });

    effect(() => {
      const id = this.item()?.id ?? null;
      untracked(() => {
        this.progress.set(null);
        if (id) this.loadProgress(id);
      });
    });

    this.bindDeepLink();

    effect(() => {
      const title = this.view().title;
      if (title) {
        this.documentTitle.setTitle(
          `${title} · ${this.translate.get('media.tracker.title')} · Shelfy`,
        );
      }
    });
  }

  private bindDeepLink(): void {
    const query = toSignal(this.route.queryParamMap, { requireSync: true });
    let deepLinked = false;
    effect(() => {
      const columns = this.columns();
      if (deepLinked || columns.length === 0) return;
      const params = query();
      const season = Number(params.get('season')) || null;
      const episode = Number(params.get('episode')) || null;
      untracked(() => {
        if (season && episode) {
          const cell = columns.find((c) => c.season === season)?.episodes[episode - 1];
          if (!cell) return;
          deepLinked = true;
          this.focusEpisode(cell);
        } else {
          deepLinked = true;
          if (season) this.goToSeason(season);
        }
      });
    });
  }

  retry(): void {
    this.loadFailed.set(false);
    this.page.load(this.mediaType(), this.externalId());
  }

  private loadProgress(id: string): void {
    const show = (progress: EpisodeProgress | null) => {
      if (this.item()?.id === id) this.progress.set(progress);
    };
    this.episodes.get(id).subscribe({ next: show, error: () => show(null) });
  }

  add(): void {
    this.addSheet.open({
      provider: EPISODE_PROVIDER[this.mediaType()] ?? 'tmdb',
      mediaType: this.mediaType(),
      externalId: String(this.externalId()),
      title: this.view().title ?? '',
      coverUrl: this.view().posterUrl ?? null,
      subtitle: null,
    });
  }

  readonly neighbours = computed(() => {
    const cell = this.selectedCell();
    return cell ? releasedNeighbours(this.columns(), cell) : { previous: null, next: null };
  });

  selectEpisode(cell: EpisodeCell): void {
    if (!cell.released) return;
    this.selectedKey.set(`${cell.season}:${cell.episode}`);
  }

  stepEpisode(direction: -1 | 1): void {
    const { previous, next } = this.neighbours();
    const target = direction === -1 ? previous : next;
    if (target) this.selectEpisode(target);
  }

  setWatched(cell: EpisodeCell, watched: boolean): void {
    this.mutate(
      (p) =>
        applyEpisodes(p, { season: cell.season, episodes: [cell.episode], isWatched: watched }),
      (id) =>
        this.episodes.update(id, {
          season: cell.season,
          episodes: [cell.episode],
          isWatched: watched,
        }),
    );
  }

  rate(cell: EpisodeCell, rating: number | null): void {
    const request = { season: cell.season, episode: cell.episode, rating };
    this.mutate(
      (p) => applyRating(p, request),
      (id) => this.episodes.rate(id, request),
    );
  }

  seasonComplete(column: SeasonColumn): boolean {
    return column.released > 0 && column.watched >= column.released;
  }

  toggleSeason(column: SeasonColumn): void {
    const watched = !this.seasonComplete(column);
    const episodes = column.episodes.filter((e) => e.released || !watched).map((e) => e.episode);
    if (episodes.length === 0) return;
    this.mutate(
      (p) => applyEpisodes(p, { season: column.season, episodes, isWatched: watched }),
      (id) => this.episodes.update(id, { season: column.season, episodes, isWatched: watched }),
    );
  }

  readonly allWatched = computed(() => {
    const { watched, released } = this.stats();
    return released > 0 && watched >= released;
  });

  async toggleAll(): Promise<void> {
    const watched = !this.allWatched();
    if (!watched) {
      const confirmed = await this.confirm.ask(
        this.translate.get('media.tracker.clear_confirm_message'),
        {
          title: this.translate.get('media.tracker.clear_confirm_title'),
          confirmLabel: this.translate.get('media.tracker.clear_all'),
          cancelLabel: this.translate.get('collection.cancel'),
          destructive: true,
        },
      );
      if (!confirmed) return;
    }
    const id = this.item()?.id;
    if (!id) return;
    this.busy.set(true);
    this.episodes.markAll(id, watched).subscribe({
      next: (progress) => {
        this.busy.set(false);
        this.settle(id, progress);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toastError(error);
      },
    });
  }

  private mutate(
    local: (progress: EpisodeProgress) => EpisodeProgress,
    remote: (itemId: string) => ReturnType<EpisodeProgressService['update']>,
  ): void {
    const id = this.item()?.id;
    const before = this.progress();
    if (!id || !before) return;
    this.progress.set(local(before));
    this.pending++;
    remote(id).subscribe({
      next: (progress) => {
        if (--this.pending === 0) this.settle(id, progress);
      },
      error: (error: unknown) => {
        this.pending--;
        this.loadProgress(id);
        this.toastError(error);
      },
    });
  }

  private settle(id: string, progress: EpisodeProgress): void {
    this.progress.set(progress);
    if (progress.status !== this.item()?.status) {
      this.collection
        .refreshItem(id)
        .subscribe({ next: (item) => this.page.collectionItem.set(item) });
    }
  }

  readonly externalColor = EXTERNAL_RATING_COLOR;

  scoreColor(score: number | null): string | null {
    return score === null ? null : ratingColor(score);
  }

  episodeLabel(cell: EpisodeCell): string {
    return `S${cell.season}E${cell.episode}` + (cell.title ? ` · ${cell.title}` : '');
  }
}
