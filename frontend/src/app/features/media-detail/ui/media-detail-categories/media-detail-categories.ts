import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagComponent } from '@shared/ui/tag/tag';
import type { DetailMediaType } from '../../data-access/media-detail-view.util';
import { browseQueryParams, browseUrl } from '../../data-access/media-detail-links.util';

@Component({
  selector: 'shelfy-media-detail-categories',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TagComponent],
  templateUrl: './media-detail-categories.html',
})
export class MediaDetailCategoriesComponent {
  readonly genres = input.required<string[]>();
  readonly genreIds = input.required<(number | string)[]>();
  readonly tags = input.required<string[]>();
  readonly tagRefs = input.required<(number | string)[]>();
  readonly mediaType = input.required<DetailMediaType>();

  protected readonly browseUrl = browseUrl;
  protected readonly browseQueryParams = browseQueryParams;

  readonly hasCategories = computed(() => this.genres().length > 0 || this.tags().length > 0);
}
