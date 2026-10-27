import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@app/core/services/translate/translate';
import type { WatchLogEntry } from '@app/core/services/watch-log/watch-log.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { RatingValueComponent } from '@shared/ui/rating-value/rating-value';
import { SpoilerGuardComponent } from '@shared/ui/spoiler-guard/spoiler-guard';
import { staggerDelay } from '@shared/ui/ui-recipes';
import type { MediaLogKind } from '@shared/utils/media-log-kind.util';
import { ratingToTextColor } from '@shared/utils/collection-rating.util';
import { richTextExcerpt } from '@shared/utils/rich-text.util';

@Component({
  selector: 'shelfy-watch-log-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    TranslatePipe,
    IconComponent,
    RatingValueComponent,
    SpoilerGuardComponent,
  ],
  templateUrl: './watch-log-timeline.html',
  host: { class: 'block' },
})
export class WatchLogTimelineComponent {
  private readonly translate = inject(TranslateService);

  entries = input.required<readonly WatchLogEntry[]>();
  kind = input.required<MediaLogKind>();
  limit = input<number | null>(null);
  readonly = input(false);

  readonly selected = output<WatchLogEntry>();

  protected readonly stagger = staggerDelay;
  protected readonly card = 'bg-fill-subtle flex min-w-0 flex-col rounded-lg p-5 md:p-6';
  protected readonly editButton = buttonClasses({ variant: 'secondary', size: 'sm' });

  protected readonly sorted = computed(() => {
    const sorted = [...this.entries()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const limit = this.limit();
    return limit === null ? sorted : sorted.slice(0, limit);
  });

  protected readonly ratingColor = (rating: number) => ratingToTextColor(rating, 100);
  protected readonly excerpt = (review: WatchLogEntry['review']) => richTextExcerpt(review, 240);

  protected longDate(occurredAt: string): string {
    return new Intl.DateTimeFormat(this.translate.lang(), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: occurredAt.length === 10 ? 'UTC' : undefined,
    }).format(new Date(occurredAt));
  }
}
