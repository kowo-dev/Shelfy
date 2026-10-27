import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { aniListLabel, type AniListLabelGroup } from '../../data-access/anilist-labels.util';
import type { DetailMediaType, MediaDetailView } from '../../data-access/media-detail-view.util';
import type { MediaStat } from '../../data-access/media-detail-stats.util';
import {
  browseQueryParams,
  browseUrl,
  companyUrl,
  franchiseUrl,
  gameCompanyUrl,
  networkUrl,
  personUrl,
  staffUrl,
  studioUrl,
} from '../../data-access/media-detail-links.util';

@Component({
  selector: 'shelfy-media-detail-metadata',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './media-detail-metadata.html',
})
export class MediaDetailMetadataComponent {
  private readonly translate = inject(TranslateService);

  readonly view = input.required<MediaDetailView>();
  readonly mediaType = input.required<DetailMediaType>();
  readonly facts = input<MediaStat[]>([]);
  readonly tier = input<'primary' | 'secondary'>('primary');

  protected readonly row = 'flex min-w-0 flex-col gap-1';

  protected readonly tierFacts = computed(() =>
    this.facts().filter((fact) => !!fact.secondary === (this.tier() === 'secondary')),
  );

  protected readonly personUrl = personUrl;
  protected readonly studioUrl = studioUrl;
  protected readonly companyUrl = companyUrl;
  protected readonly networkUrl = networkUrl;
  protected readonly gameCompanyUrl = gameCompanyUrl;
  protected readonly browseUrl = browseUrl;
  protected readonly browseQueryParams = browseQueryParams;
  protected readonly franchiseUrl = franchiseUrl;

  protected readonly creditedOnAniList = computed(() =>
    ['anime', 'manga', 'webtoon'].includes(this.mediaType()),
  );

  protected creditUrl(id: number | string): string {
    return this.creditedOnAniList() ? staffUrl(id) : personUrl(id);
  }

  protected authorLink(key: string): string {
    return staffUrl(key);
  }

  protected aniListLabel(group: AniListLabelGroup, value: string): string {
    return aniListLabel(group, value, this.translate);
  }

  readonly hasMetadata = computed(() => {
    const view = this.view();
    if (this.tierFacts().length > 0) return true;
    if (this.tier() === 'primary') {
      return Boolean(
        view.director ||
        view.authors.length > 0 ||
        view.studios.length > 0 ||
        view.networks.length > 0 ||
        view.developers.length > 0 ||
        view.publishers.length > 0 ||
        view.platforms.length > 0,
      );
    }
    return Boolean(
      (view.originalTitle && view.originalTitle !== view.title) ||
      view.themes.length > 0 ||
      view.gameModes.length > 0 ||
      view.source ||
      view.season ||
      view.volumes !== null ||
      view.franchiseName,
    );
  });
}
