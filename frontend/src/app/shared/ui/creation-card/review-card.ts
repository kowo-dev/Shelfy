import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdultGateService } from '@app/core/services/adult-gate/adult-gate';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TranslateService } from '@app/core/services/translate/translate';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { IconComponent } from '@shared/ui/icon/icon';
import { SocialCountsComponent } from '@shared/ui/social-counts/social-counts';
import { mediaBackdropUrl } from '@shared/utils/media-backdrop.util';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';
import { creationView } from './creation-view';

@Component({
  selector: 'shelfy-review-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, AvatarComponent, IconComponent, SocialCountsComponent],
  template: `
    @if (card(); as card) {
      <a
        [routerLink]="card.route"
        class="group/card flex h-full w-full flex-col"
        (click)="onOpen($event)"
      >
        <span
          class="rounded-card bg-surface shadow-poster ease-expo group-hover/card:shadow-poster-hover relative grid aspect-video place-items-center overflow-hidden transition-[translate,box-shadow] duration-700 motion-safe:group-hover/card:-translate-y-1.5"
        >
          @if (card.cover; as cover) {
            <img
              [src]="cover"
              alt=""
              class="ease-expo absolute inset-0 size-full object-cover object-[50%_25%] transition-transform duration-1200 group-hover/card:scale-[1.04]"
              loading="lazy"
            />
          } @else {
            <shelfy-icon name="reviews" size="28" class="text-text-subtle" />
          }
        </span>
        <span class="mt-4 flex min-w-0 items-center justify-between gap-3">
          <b class="text-text min-w-0 truncate text-lg font-semibold">{{
            card.gated ? ('adult.hidden' | translate) : card.title
          }}</b>
          @if (card.rating; as rating) {
            <span
              class="inline-flex shrink-0 items-center gap-1.5 text-xl font-bold tabular-nums"
              [style.color]="rating.color"
            >
              <shelfy-icon name="star" size="20" [active]="true" />{{ rating.text }}
            </span>
          }
        </span>
        @if (card.excerpt; as excerpt) {
          <q
            class="text-text-muted mt-1.5 line-clamp-2 text-[0.9375rem] leading-relaxed before:content-['“'] after:content-['”']"
            >{{ excerpt }}</q
          >
        } @else {
          <p class="text-text-subtle mt-1.5 text-[0.9375rem]">
            {{ 'home.review_spoilers' | translate }}
          </p>
        }
        <span class="mt-4 flex min-w-0 items-center gap-3">
          <span
            class="text-text-subtle flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm whitespace-nowrap"
          >
            <shelfy-avatar size="28" [displayName]="card.creator" [avatarUrl]="card.avatar" />
            <b class="text-text min-w-0 truncate font-semibold">{{ card.creator }}</b>
            @if (date(); as when) {
              <span class="shrink-0 opacity-60" aria-hidden="true">·</span>
              <span class="shrink-0 tabular-nums">{{ when }}</span>
            }
          </span>
          <shelfy-social-counts
            class="shrink-0"
            [likeCount]="card.likes"
            [commentCount]="card.comments"
          />
        </span>
      </a>
    }
  `,
  host: { class: 'block min-w-0' },
})
export class ReviewCardComponent {
  private readonly adultGate = inject(AdultGateService);
  private readonly dates = inject(DateFormatService);
  private readonly translate = inject(TranslateService);

  readonly review = input.required<ReviewResponse>();
  readonly dated = input(false);

  readonly card = computed(() => {
    const review = this.review();
    const view = creationView({ review });
    if (!view) return null;
    return {
      route: view.route,
      title: review.media.title,
      gated: view.gated,
      cover: view.gated || review.media.isAdult ? null : mediaBackdropUrl(review.media, 'wide'),
      excerpt: view.excerpt,
      creator: view.creator ?? '',
      avatar: view.creatorAvatar,
      likes: view.likes,
      comments: view.comments,
      rating:
        review.rating === null
          ? null
          : { text: formatRating(review.rating), color: ratingToTextColor(review.rating, 100) },
    };
  });

  readonly date = computed(() =>
    this.dated()
      ? this.dates.formatRelative(new Date(this.review().updatedAt), this.translate.lang())
      : null,
  );

  onOpen(event: Event): void {
    if (!this.card()?.gated) return;
    event.preventDefault();
    void this.adultGate.open();
  }
}
