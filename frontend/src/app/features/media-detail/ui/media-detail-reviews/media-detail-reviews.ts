import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { RatingValueComponent } from '@shared/ui/rating-value/rating-value';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { SocialCountsComponent } from '@shared/ui/social-counts/social-counts';
import { SpoilerGuardComponent } from '@shared/ui/spoiler-guard/spoiler-guard';
import { ratingToTextColor } from '@shared/utils/collection-rating.util';
import { richTextExcerpt } from '@shared/utils/rich-text.util';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TranslateService } from '@app/core/services/translate/translate';

@Component({
  selector: 'shelfy-media-detail-reviews',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    RouterLink,
    AvatarComponent,
    SpoilerGuardComponent,
    SocialCountsComponent,
    RatingValueComponent,
  ],
  templateUrl: './media-detail-reviews.html',
  host: { class: 'contents' },
})
export class MediaDetailReviewsComponent {
  private readonly dates = inject(DateFormatService);
  private readonly translate = inject(TranslateService);

  readonly reviews = input.required<ReviewResponse[]>();

  protected readonly when = (date: string) =>
    this.dates.formatRelative(new Date(date), this.translate.lang());

  protected readonly excerpt = (content: ReviewResponse['content']) =>
    richTextExcerpt(content, 400);

  protected readonly ratingColor = (rating: number) => ratingToTextColor(rating, 100);
}
