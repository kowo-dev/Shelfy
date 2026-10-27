import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { MediaType } from '@app/core/services/collection/collection.model';
import { RelatedMediaService } from '@app/core/services/related/related';
import type { RelatedEntity, RelatedSection } from '@app/core/services/related/related.model';
import type { SearchResult } from '@app/core/services/search/search.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { RailSkeletonComponent } from '@shared/ui/rail-skeleton/rail-skeleton';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { toPlaceholderCollectionItem } from '@shared/utils/media-placeholder-item.util';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import { injectSearchResultCover } from '@shared/utils/search-result-cover.util';
import {
  companyUrl,
  franchiseUrl,
  gameCompanyUrl,
  networkUrl,
  personUrl,
  staffUrl,
  studioUrl,
} from '../../data-access/media-detail-links.util';

const ENTITY_URL: Record<RelatedEntity['kind'], (id: string) => string> = {
  people: personUrl,
  staff: staffUrl,
  companies: companyUrl,
  networks: networkUrl,
  studios: studioUrl,
  'game-companies': gameCompanyUrl,
  franchises: franchiseUrl,
};

function entityTitleKey(entity: RelatedEntity): string {
  if (entity.role === 'director') return 'media.related.directed_by';
  if (entity.kind === 'staff') return 'media.related.works_and_adaptations';
  if (entity.kind === 'networks') return 'media.related.also_on';
  return 'media.related.more_from';
}

@Component({
  selector: 'shelfy-media-detail-related',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ShelfSectionComponent, MediaCardComponent, RailSkeletonComponent],
  templateUrl: './media-detail-related.html',
  host: { class: 'contents' },
})
export class MediaDetailRelatedComponent {
  private readonly related = inject(RelatedMediaService);
  private readonly translate = inject(TranslateService);
  readonly coverUrl = injectSearchResultCover();

  readonly mediaType = input.required<MediaType>();
  readonly externalId = input.required<number | string>();

  readonly sections = signal<RelatedSection[] | null>(null);
  readonly rails = computed(() => {
    this.translate.lang();
    return this.sections()?.map((section) => ({
      key: this.sectionKey(section),
      title: this.title(section),
      more: this.viewAllRoute(section),
      cards: section.items.map((item) => ({
        key: this.itemKey(item),
        year: item.releaseYear ? String(item.releaseYear) : null,
        item: toPlaceholderCollectionItem({
          id: `${item.provider}:${item.mediaType}:${item.externalId}`,
          canonicalWorkId: '',
          externalId: item.externalId,
          provider: item.provider,
          mediaType: item.mediaType,
          title: item.title,
          coverUrl: this.coverUrl(item),
          metadata: { releaseYear: item.releaseYear },
          createdAt: '',
        }),
      })),
    }));
  });

  constructor() {
    effect((onCleanup) => {
      const subscription = this.related.getRelated(this.mediaType(), this.externalId()).subscribe({
        next: (response) => this.sections.set(response.sections),
        error: () => this.sections.set([]),
      });
      onCleanup(() => {
        subscription.unsubscribe();
        this.sections.set(null);
      });
    });
  }

  title(section: RelatedSection): string {
    switch (section.kind) {
      case 'similar':
        return this.translate.get('media.related.similar');
      case 'franchise':
        return section.label ?? this.translate.get('media.related.franchise');
      case 'entity':
        return this.translate.get(entityTitleKey(section.entity), { name: section.entity.name });
    }
  }

  viewAllRoute(section: RelatedSection): string[] | null {
    switch (section.kind) {
      case 'similar':
        return section.hasMore
          ? ['/media', this.mediaType(), String(this.externalId()), 'similar']
          : null;
      case 'franchise':
        return section.entity ? [ENTITY_URL[section.entity.kind](section.entity.id)] : null;
      case 'entity':
        return [ENTITY_URL[section.entity.kind](section.entity.id)];
    }
  }

  sectionKey(section: RelatedSection): string {
    return section.kind === 'entity'
      ? `entity:${section.entity.kind}:${section.entity.id}`
      : section.kind;
  }

  itemKey(item: SearchResult): string {
    return `${item.mediaType}:${item.externalId}`;
  }
}
