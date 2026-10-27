import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map, of, type Observable } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { TranslateService } from '@app/core/services/translate/translate';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { IgdbService } from '@app/core/services/igdb/igdb';
import type { GameSummary, MediaPageResponse } from '@app/core/services/igdb/igdb.model';
import { AniListService } from '@app/core/services/anilist/anilist';
import { buildPreviewItem } from '@app/features/discover/data-access/discover-preview.util';
import { type DiscoverCategory } from '@app/core/services/discover/discover.model';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { appendDistinct } from '@shared/utils/append-distinct.util';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { EntityShelfComponent, type EntityFact } from '../ui/entity-shelf';

const ANILIST_TYPES = new Set(['anime', 'manga', 'webtoon']);

interface BrowseTarget {
  mediaType: string;
  facet: string | null;
  ref: string | null;
}

interface BrowsePage {
  items: MediaItem[];
  hasMore: boolean;
}

interface MediaItem {
  id: string;
  mediaType: string;
  title: string;
  imageUrl: string | null;
  rating: number | null;
}

@Component({
  selector: 'shelfy-browse-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent, EntityShelfComponent],
  template: `
    @if (loading()) {
      <div class="mt-24 flex justify-center"><shelfy-spinner /></div>
    } @else {
      <shelfy-entity-shelf
        [title]="title()"
        [facts]="facts()"
        [items]="cardItems()"
        [hasMore]="hasMore()"
        (loadMore)="loadMore()"
        (opened)="goToMedia($event)"
      />
    }
  `,
})
export class BrowsePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private loadingMore = false;
  private readonly tmdb = inject(TmdbService);
  private readonly igdb = inject(IgdbService);
  private readonly anilist = inject(AniListService);
  private readonly onError = catchAndToastError(inject(ToastService), inject(ErrorMessageService));

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly mediaType = computed(() => this.params().get('mediaType') ?? 'all');
  readonly facet = computed(() => this.params().get('facet'));
  readonly ref = computed(() => this.params().get('ref'));

  private readonly target = computed(() => ({
    mediaType: this.mediaType(),
    facet: this.facet(),
    ref: this.ref(),
  }));

  private readonly firstPage = rxResource({
    params: () => this.target(),
    stream: ({ params }) => this.fetchPage(params, 1),
  });

  readonly loading = computed(() => this.firstPage.isLoading());
  readonly items = linkedSignal<MediaItem[]>(() =>
    this.firstPage.hasValue() ? this.firstPage.value().items : [],
  );
  readonly hasMore = linkedSignal(
    () => this.firstPage.hasValue() && this.firstPage.value().hasMore,
  );
  private readonly page = linkedSignal(() => (this.target(), 1));
  readonly title = computed(() => this.queryParams().get('name') ?? this.formatTitle());
  readonly cardItems = computed(() =>
    this.items().map((item) =>
      buildPreviewItem(
        item.mediaType as DiscoverCategory,
        item.id,
        item.title,
        item.imageUrl,
        item.rating,
        null,
        {},
      ),
    ),
  );

  readonly facts = computed<EntityFact[]>(() => {
    this.translate.lang();
    const facts: EntityFact[] = [];
    const type = this.mediaType();
    if (type !== 'all') facts.push({ label: this.translate.get('collection.media_type.' + type) });
    const count = this.items().length;
    if (count) {
      facts.push({
        value: `${count}${this.hasMore() ? '+' : ''}`,
        label: this.translate.get(count === 1 ? 'entity.title_one' : 'entity.title_many'),
      });
    }
    return facts;
  });

  private formatTitle(): string {
    const ref = this.ref();
    if (ref) {
      const name = ref.replace(/-/g, ' ');
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    const facet = this.facet();
    if (facet) return `${facet.charAt(0).toUpperCase() + facet.slice(1)} ${this.mediaType()}`;
    return 'Browse';
  }

  goToMedia(item: CollectionItemResponse): void {
    this.router.navigate(['/media', item.media.mediaType, item.media.externalId]);
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore) return;
    this.loadingMore = true;
    const target = this.target();
    const page = this.page() + 1;
    this.fetchPage(target, page).subscribe({
      next: (next) => {
        this.loadingMore = false;
        if (this.target() !== target) return;
        this.page.set(page);
        this.items.update((current) =>
          appendDistinct(current, next.items, (item) => `${item.mediaType}:${item.id}`),
        );
        this.hasMore.set(next.hasMore);
      },
      error: (error: unknown) => {
        this.loadingMore = false;
        this.hasMore.set(false);
        this.onError(error);
      },
    });
  }

  private fetchPage({ mediaType, facet, ref }: BrowseTarget, page: number): Observable<BrowsePage> {
    const id = ref ? Number(ref) : null;
    if (facet === 'genre' && id && mediaType === 'movie') return this.moviePage(id, page);
    if (facet === 'genre' && id && mediaType === 'tv_show') return this.tvShowPage(id, page);
    const games = facet && id && mediaType === 'game' ? this.gameFacets[facet] : undefined;
    if (games && id) return this.gamePage(games, id, page);
    if (ref && ANILIST_TYPES.has(mediaType) && (facet === 'genre' || facet === 'tag')) {
      return this.aniListPage(mediaType, facet, ref, page);
    }
    return of({ items: [], hasMore: false });
  }

  private moviePage(genreId: number, page: number): Observable<BrowsePage> {
    return this.tmdb.getMoviesByGenre(genreId, page).pipe(
      map((r) => ({
        items: r.results.map((m) =>
          this.tmdbItem('movie', m.id, m.title, m.posterPath, m.voteAverage),
        ),
        hasMore: r.page < r.totalPages,
      })),
    );
  }

  private tvShowPage(genreId: number, page: number): Observable<BrowsePage> {
    return this.tmdb.getTvShowsByGenre(genreId, page).pipe(
      map((r) => ({
        items: r.results.map((t) =>
          this.tmdbItem('tv_show', t.id, t.name, t.posterPath, t.voteAverage),
        ),
        hasMore: r.page < r.totalPages,
      })),
    );
  }

  private gamePage(
    games: (id: number, page: number) => Observable<MediaPageResponse<GameSummary>>,
    id: number,
    page: number,
  ): Observable<BrowsePage> {
    return games(id, page - 1).pipe(
      map((r) => ({
        items: r.content.map((g) => ({
          id: String(g.id),
          mediaType: 'game',
          title: g.name,
          imageUrl: g.coverImageId ? this.igdb.imageUrl(g.coverImageId, 't_1080p') : null,
          rating: g.rating,
        })),
        hasMore: r.hasMore,
      })),
    );
  }

  private aniListPage(
    mediaType: BrowseTarget['mediaType'],
    facet: 'genre' | 'tag',
    ref: string,
    page: number,
  ): Observable<BrowsePage> {
    const request =
      facet === 'genre'
        ? this.anilist.browseByGenre(mediaType, ref, page)
        : this.anilist.browseByTag(mediaType, ref, page);
    return request.pipe(
      map((r) => ({
        items: r.items.map((m) => ({
          id: String(m.id),
          mediaType: m.mediaType,
          title: m.title,
          imageUrl: m.coverImageUrl,
          rating: m.rating,
        })),
        hasMore: r.hasMore,
      })),
    );
  }

  private readonly gameFacets: Record<
    string,
    (id: number, page: number) => Observable<MediaPageResponse<GameSummary>>
  > = {
    genre: (id, page) => this.igdb.getGamesByGenre(id, page),
    platform: (id, page) => this.igdb.getGamesByPlatform(id, page),
    theme: (id, page) => this.igdb.getGamesByTheme(id, page),
    'game-mode': (id, page) => this.igdb.getGamesByGameMode(id, page),
  };

  private tmdbItem(
    mediaType: string,
    id: number,
    title: string,
    posterPath: string | null,
    rating: number,
  ): MediaItem {
    return {
      id: String(id),
      mediaType,
      title,
      imageUrl: posterPath ? this.tmdb.imageUrl(posterPath, 'w342') : null,
      rating,
    };
  }
}
