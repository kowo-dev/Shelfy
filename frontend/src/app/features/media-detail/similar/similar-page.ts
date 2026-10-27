import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import type {
  CollectionItemResponse,
  MediaType,
} from '@app/core/services/collection/collection.model';
import { RelatedMediaService } from '@app/core/services/related/related';
import type { SearchResult } from '@app/core/services/search/search.model';
import { buildPreviewItem } from '@app/features/discover/data-access/discover-preview.util';
import { EntityShelfComponent, type EntityFact } from '@app/features/entity/ui/entity-shelf';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ButtonComponent } from '@shared/ui/button/button';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { injectSearchResultCover } from '@shared/utils/search-result-cover.util';

@Component({
  selector: 'shelfy-similar-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    EmptyStateComponent,
    SpinnerComponent,
    TranslatePipe,
    EntityShelfComponent,
  ],
  template: `
    @if (loading() && items().length === 0) {
      <div class="mt-24 flex justify-center" role="status"><shelfy-spinner /></div>
    } @else if (failed() && items().length === 0) {
      <main class="px-gutter flex min-h-full items-center justify-center pt-(--nav-bar-height)">
        <shelfy-empty-state
          role="alert"
          icon="warningTriangle"
          [hint]="'discover.load_error' | translate"
        >
          <shelfy-button variant="primary" (click)="retry()">
            {{ 'collection.retry' | translate }}
          </shelfy-button>
        </shelfy-empty-state>
      </main>
    } @else {
      <shelfy-entity-shelf
        [title]="'media.related.similar' | translate"
        [facts]="facts()"
        [items]="cardItems()"
        [hasMore]="hasMore()"
        (loadMore)="loadMore()"
        (opened)="goToMedia($event)"
      />
    }
  `,
})
export class SimilarPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly related = inject(RelatedMediaService);
  private readonly coverUrl = injectSearchResultCover();

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly translate = inject(TranslateService);
  readonly mediaType = computed(() => this.params().get('mediaType') as MediaType);
  readonly externalId = computed(() => this.params().get('externalId') ?? '');

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly items = signal<SearchResult[]>([]);
  readonly hasMore = signal(false);
  readonly cardItems = computed(() =>
    this.items().map((item) =>
      buildPreviewItem(
        item.mediaType,
        item.externalId,
        item.title,
        this.coverUrl(item),
        item.voteAverage,
        null,
        {},
      ),
    ),
  );

  readonly facts = computed<EntityFact[]>(() => {
    this.translate.lang();
    const count = this.items().length;
    if (!count) return [];
    return [
      {
        value: `${count}${this.hasMore() ? '+' : ''}`,
        label: this.translate.get(count === 1 ? 'entity.title_one' : 'entity.title_many'),
      },
    ];
  });

  private page = 1;
  private request: Subscription | null = null;

  constructor() {
    effect(() => {
      const mediaType = this.mediaType();
      const externalId = this.externalId();
      this.page = 1;
      this.items.set([]);
      this.fetch(mediaType, externalId);
    });
  }

  retry(): void {
    this.fetch(this.mediaType(), this.externalId());
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.page++;
    this.fetch(this.mediaType(), this.externalId());
  }

  goToMedia(item: CollectionItemResponse): void {
    this.router.navigate(['/media', item.media.mediaType, item.media.externalId]);
  }

  private fetch(mediaType: MediaType, externalId: string): void {
    this.loading.set(true);
    this.failed.set(false);
    this.request?.unsubscribe();
    this.request = this.related.getSimilar(mediaType, externalId, this.page).subscribe({
      next: (response) => {
        this.items.update((current) => {
          const seen = new Set(current.map((item) => item.externalId));
          return [...current, ...response.results.filter((item) => !seen.has(item.externalId))];
        });
        this.hasMore.set(response.hasMore);
        this.loading.set(false);
      },
      error: () => {
        this.hasMore.set(false);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}
