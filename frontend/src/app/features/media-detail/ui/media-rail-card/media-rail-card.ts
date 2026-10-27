import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { MediaResponse, MediaType } from '@app/core/services/collection/collection.model';
import { toPlaceholderCollectionItem } from '@shared/utils/media-placeholder-item.util';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';

@Component({
  selector: 'shelfy-media-rail-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MediaCardComponent],
  template: `<shelfy-media-card [item]="item()" [rank]="rank()" />`,
  host: { class: 'block' },
})
export class MediaRailCardComponent {
  readonly provider = input.required<string>();
  readonly mediaType = input.required<MediaType>();
  readonly externalId = input.required<string>();
  readonly title = input.required<string>();
  readonly coverUrl = input<string | null>(null);
  readonly metadata = input<Record<string, unknown> | null>(null);
  readonly rank = input<number | null>(null);

  readonly item = computed(() =>
    toPlaceholderCollectionItem({
      id: `${this.provider()}:${this.mediaType()}:${this.externalId()}`,
      canonicalWorkId: '',
      externalId: this.externalId(),
      provider: this.provider(),
      mediaType: this.mediaType(),
      title: this.title(),
      coverUrl: this.coverUrl(),
      metadata: this.metadata(),
      createdAt: '',
    } satisfies MediaResponse),
  );
}
