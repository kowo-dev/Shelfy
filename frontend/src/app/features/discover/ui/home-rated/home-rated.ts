import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { formatRating } from '@shared/utils/collection-rating.util';
import { imageRendition } from '@shared/utils/image-rendition.util';
import type { HomeFilter } from '../../data-access/home-discovery';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';

@Component({
  selector: 'shelfy-home-rated',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, ShelfSectionComponent],
  template: `
    <shelfy-shelf-section
      [title]="'home.top_rated' | translate"
      [subtitle]="'home.top_rated_sub' | translate"
      [moreLabel]="'home.see_all' | translate"
      [moreRoute]="['/discover', 'top_rated']"
      [moreQuery]="query()"
      [band]="true"
      [rail]="null"
    >
      <ol class="v-chart">
        @for (row of rows(); track row.id) {
          <li tabindex="0" (click)="open(row.route)" (keydown.enter)="open(row.route)">
            <span class="n">{{ row.rank }}</span>
            <span class="cv"><img [src]="row.cover" alt="" loading="lazy" /></span>
            <span class="t">
              <b>{{ row.title }}</b>
              <span>{{ row.meta }}</span>
            </span>
            <span
              class="v-star"
              [attr.aria-label]="'home.rated_label' | translate: { rating: row.rating }"
              ><shelfy-icon name="star" size="14" [active]="true" />{{ row.rating }}</span
            >
          </li>
        }
      </ol>
    </shelfy-shelf-section>
  `,
  host: { class: 'block' },
})
export class HomeRatedComponent {
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  filter = input<HomeFilter>('all');
  readonly query = computed(() => (this.filter() === 'all' ? {} : { type: this.filter() }));

  items = input.required<CollectionItemResponse[]>();

  readonly rows = computed(() => {
    this.translate.lang();
    return this.items().map((item, index) => {
      const { media } = item;
      const date = media.metadata?.['releaseDate'];
      const year = typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : null;
      const type = this.translate.get('collection.media_type_one.' + media.mediaType);
      const rating = item.rating ?? 0;
      return {
        id: item.id,
        rank: index + 1,
        route: ['/media', media.mediaType, media.externalId],
        cover: media.coverUrl ? imageRendition(media.coverUrl, 'tile') : null,
        title: media.title,
        meta: year ? `${type} · ${year}` : type,
        rating: formatRating(rating),
      };
    });
  });

  open(route: string[]): void {
    void this.router.navigate(route);
  }
}
