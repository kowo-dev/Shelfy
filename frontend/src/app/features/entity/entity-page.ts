import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AniListService } from '@app/core/services/anilist/anilist';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import type { PersonCredit } from '@app/core/services/tmdb/tmdb.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { appendDistinct } from '@shared/utils/append-distinct.util';
import { EntityShelfComponent, type EntityFact } from './ui/entity-shelf';
import type { EntitySortDirection, EntitySortOption } from './ui/entity-sort';
import type { EntityKind } from './entity.model';
import { createEntitySources, previewItem } from './entity-sources';

type PersonCreditSort = 'popularity' | 'releaseDate';

const PORTRAIT_KINDS: readonly EntityKind[] = ['people', 'staff', 'characters'];
const DATED_KINDS: readonly EntityKind[] = ['people'];

@Component({
  selector: 'shelfy-entity-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, SpinnerComponent, TranslatePipe, EntityShelfComponent],
  templateUrl: './entity-page.html',
})
export class EntityPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tmdb = inject(TmdbService);
  private readonly translate = inject(TranslateService);
  private readonly igdb = inject(IgdbService);
  private readonly anilist = inject(AniListService);
  private readonly onError = catchAndToastError(inject(ToastService), inject(ErrorMessageService));
  private readonly sources = createEntitySources({
    tmdb: this.tmdb,
    igdb: this.igdb,
    anilist: this.anilist,
  });

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly data = toSignal(this.route.data, { requireSync: true });

  readonly kind = computed(() => this.data()['entityKind'] as EntityKind);
  readonly id = computed(() => this.params().get('id'));

  private readonly target = computed(() => {
    const id = this.id();
    const kind = this.kind();
    return id && kind ? { id, kind } : undefined;
  });

  private readonly entity = rxResource({
    params: () => this.target(),
    stream: ({ params }) => this.sources[params.kind].load(params.id),
  });

  readonly loading = computed(() => this.entity.isLoading());
  readonly header = computed(() => (this.entity.hasValue() ? this.entity.value().header : null));
  readonly personCredits = computed(() =>
    this.entity.hasValue() ? (this.entity.value().credits ?? []) : [],
  );
  readonly items = linkedSignal(() => (this.entity.hasValue() ? this.entity.value().items : []));
  readonly hasMore = linkedSignal(() => this.entity.hasValue() && this.entity.value().hasMore);
  private readonly page = linkedSignal(() => (this.target(), 0));

  readonly personCreditSort = linkedSignal<PersonCreditSort>(() => (this.target(), 'popularity'));
  readonly personCreditSortDirection = linkedSignal<EntitySortDirection>(
    () => (this.target(), 'desc'),
  );
  readonly personCreditSorts: readonly PersonCreditSort[] = ['popularity', 'releaseDate'];
  private loadingMore = false;
  readonly sorts = computed<readonly EntitySortOption[]>(() => {
    this.translate.lang();
    if (!this.isPerson()) return [];
    return this.personCreditSorts.map((sort) => ({
      id: sort,
      label: this.translate.get(`entity.filmography_sort.${sort}`),
      natural: 'desc' as const,
    }));
  });
  readonly leadShape = computed(() => (PORTRAIT_KINDS.includes(this.kind()) ? 'portrait' : 'logo'));
  readonly facts = computed<EntityFact[]>(() => {
    this.translate.lang();
    const header = this.header();
    if (!header) return [];
    const facts: EntityFact[] = [];
    if (header.subtitle) facts.push({ label: this.subtitle(header.subtitle) });
    const count = this.displayedItems().length;
    if (count) {
      facts.push({
        value: `${count}${this.hasMore() ? '+' : ''}`,
        label: this.translate.get(count === 1 ? 'entity.title_one' : 'entity.title_many'),
      });
    }
    return facts;
  });
  readonly displayedItems = computed(() => {
    if (!this.isPerson()) return this.items();

    const sort = this.personCreditSort();
    const direction = this.personCreditSortDirection();
    const credits = this.personCredits().filter(
      (credit) => credit.mediaType === 'movie' || this.isTvCredit(credit),
    );
    return [...credits]
      .sort((left, right) => {
        if (sort === 'releaseDate') {
          const comparison = (left.releaseDate ?? '').localeCompare(right.releaseDate ?? '');
          return direction === 'asc' ? comparison : -comparison;
        }
        const comparison = left.popularity - right.popularity;
        return direction === 'asc' ? comparison : -comparison;
      })
      .map((credit) =>
        previewItem(
          credit.mediaType === 'movie' ? 'movie' : 'tv_show',
          credit.mediaId,
          credit.title,
          this.tmdb.imageUrl(credit.posterPath, 'w342'),
          credit.voteAverage,
          credit.character ?? credit.job,
        ),
      );
  });

  openMedia(item: CollectionItemResponse): void {
    this.router.navigate(['/media', item.media.mediaType, item.media.externalId]);
  }

  selectPersonCreditSort(sort: string): void {
    if (this.personCreditSorts.includes(sort as PersonCreditSort)) {
      this.personCreditSort.set(sort as PersonCreditSort);
    }
  }

  loadMore(): void {
    const target = this.target();
    const more = target && this.sources[target.kind].more;
    if (!target || !more || !this.hasMore() || this.loadingMore) return;
    this.loadingMore = true;
    const page = this.page() + 1;
    more(target.id, page).subscribe({
      next: (next) => {
        this.loadingMore = false;
        if (this.target() !== target) return;
        this.page.set(page);
        this.items.update((current) => appendDistinct(current, next.items, (item) => item.id));
        this.hasMore.set(next.hasMore);
      },
      error: (error: unknown) => {
        this.loadingMore = false;
        this.hasMore.set(false);
        this.onError(error);
      },
    });
  }

  isPerson(): boolean {
    return this.kind() === 'people';
  }

  private subtitle(value: string): string {
    if (!DATED_KINDS.includes(this.kind()) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    const formatted = date.toLocaleDateString(this.translate.lang(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return this.translate.get('entity.born', { date: formatted });
  }

  private isTvCredit(credit: PersonCredit): boolean {
    return credit.mediaType === 'tv' || credit.mediaType === 'tv_show';
  }
}
