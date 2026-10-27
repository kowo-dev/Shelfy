import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  MediaListResponse,
  MediaListSummaryResponse,
} from '@app/core/services/lists/lists.model';
import { AdultGateService } from '@app/core/services/adult-gate/adult-gate';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import type { VersusPoolSummaryResponse } from '@app/core/services/versus/versus.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AdultBadgeComponent } from '@shared/ui/adult-badge/adult-badge';
import { IconComponent } from '@shared/ui/icon/icon';
import { RatingValueComponent } from '@shared/ui/rating-value/rating-value';
import { CARD_LIFT } from '@shared/ui/ui-recipes';
import { ratingToTextColor } from '@shared/utils/collection-rating.util';
import { creationView, type CreationView } from './creation-view';

export const CREATION_GRID = 'grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3';

const EMPTY_VIEW: CreationView = {
  kind: 'list',
  route: [],
  title: '',
  covers: [],
  gated: false,
  creator: null,
  creatorRoute: null,
  creatorAvatar: null,
  excerpt: null,
  countKey: null,
  count: 0,
  likes: 0,
  comments: 0,
  rating: null,
  visibility: null,
};

const VISIBILITY_ICON = { public: 'eye', link: 'link', private: 'lock' } as const;
const BADGE_SIZE = { review: '3rem', list: '1.75rem', versus: '2.25rem' } as const;

@Component({
  selector: 'shelfy-creation-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, AdultBadgeComponent, IconComponent, RatingValueComponent],
  template: `
    @let card = view();
    <article class="group/card flex flex-col gap-3">
      <a
        [routerLink]="card.route"
        class="group bg-surface-raised relative isolate flex aspect-video gap-0.5 overflow-hidden rounded-lg"
        [class]="surface"
        [attr.aria-label]="card.gated ? ('adult.hidden' | translate) : card.title"
        (click)="onOpen($event, card)"
      >
        @for (cover of card.covers; track $index) {
          <span class="relative h-full min-w-0 flex-1 overflow-hidden">
            @if (cover.adult) {
              <span class="absolute inset-0 grid place-items-center">
                <shelfy-adult-badge [size]="badgeSize()" />
              </span>
            } @else if (cover.url) {
              <img
                [src]="cover.url"
                alt=""
                loading="lazy"
                draggable="false"
                class="size-full object-cover"
              />
            } @else if (cover.title) {
              <span
                class="font-display text-text-subtle absolute inset-0 grid place-items-center p-3 text-center text-sm font-bold text-balance"
                >{{ cover.title }}</span
              >
            }
          </span>
        }
        @if (card.excerpt && !card.gated) {
          <span
            class="from-background/90 via-background/50 absolute inset-x-0 bottom-0 bg-linear-to-t to-transparent px-4 pt-10 pb-3"
          >
            <span class="text-text drop-shadow-media line-clamp-2 text-sm leading-relaxed"
              >“{{ card.excerpt }}”</span
            >
          </span>
        }
        @if (card.kind === 'versus') {
          <span
            class="bg-media-chip text-text font-display absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-sm font-extrabold"
            aria-hidden="true"
            >VS</span
          >
        }
      </a>
      <div class="flex min-w-0 items-center gap-3">
        @if (card.creator) {
          <a
            [routerLink]="card.creatorRoute"
            class="shrink-0 rounded-full transition-opacity hover:opacity-80"
            [attr.aria-label]="card.creator"
            [attr.tabindex]="-1"
          >
            @if (card.creatorAvatar) {
              <img
                [src]="card.creatorAvatar"
                alt=""
                loading="lazy"
                class="size-10 rounded-full object-cover"
              />
            } @else {
              <span
                class="bg-fill text-text-muted font-display grid size-10 place-items-center rounded-full text-sm font-extrabold"
                aria-hidden="true"
                >{{ card.creator.charAt(0).toUpperCase() }}</span
              >
            }
          </a>
        }
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="flex min-w-0 items-center gap-3">
            <a
              [routerLink]="card.route"
              class="text-text min-w-0 flex-1 truncate text-base font-semibold hover:underline"
              (click)="onOpen($event, card)"
              >{{ card.gated ? ('adult.hidden' | translate) : card.title }}</a
            >
            <span
              class="text-text inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums"
            >
              <shelfy-icon name="like" size="18" [active]="true" />
              <span class="sr-only">{{
                'community.likes_count' | translate: { count: card.likes }
              }}</span>
              <span aria-hidden="true">{{ card.likes }}</span>
            </span>
          </span>
          <span class="text-text-subtle flex min-w-0 items-center gap-1.5 text-sm">
            @if (card.creator) {
              <a
                [routerLink]="card.creatorRoute"
                class="hover:text-text truncate transition-colors"
                >{{ card.creator }}</a
              >
            }
            @if (card.countKey; as key) {
              @if (card.creator) {
                <span aria-hidden="true">·</span>
              }
              <span class="shrink-0 tabular-nums">{{
                key | translate: { count: card.count }
              }}</span>
            }
            @if (rating(); as score) {
              @if (card.creator) {
                <span aria-hidden="true">·</span>
              }
              <shelfy-rating-value
                class="shrink-0 font-semibold"
                [value]="score.value"
                [color]="score.color"
              />
            }
            @if (showVisibility() && card.visibility; as visibility) {
              <span aria-hidden="true">·</span>
              <span
                class="inline-flex shrink-0 items-center gap-1"
                [title]="'community.visibility.' + visibility | translate"
              >
                <shelfy-icon [name]="visibilityIcon[visibility]" size="xs" />
                <span class="sr-only">{{ 'community.visibility.' + visibility | translate }}</span>
              </span>
            }
          </span>
        </span>
      </div>
    </article>
  `,
  host: { class: 'block min-w-0' },
})
export class CreationCardComponent {
  protected readonly surface = CARD_LIFT;

  readonly list = input<MediaListSummaryResponse | MediaListResponse | null>(null);
  readonly pool = input<VersusPoolSummaryResponse | null>(null);
  readonly review = input<ReviewResponse | null>(null);
  readonly showVisibility = input(false);

  readonly visibilityIcon = VISIBILITY_ICON;

  private readonly adultGate = inject(AdultGateService);

  readonly view = computed<CreationView>(
    () =>
      creationView({ list: this.list(), pool: this.pool(), review: this.review() }) ?? EMPTY_VIEW,
  );

  readonly badgeSize = computed(() => BADGE_SIZE[this.view().kind]);

  readonly rating = computed(() => {
    const value = this.view().rating;
    return value === null ? null : { value, color: ratingToTextColor(value, 100) };
  });

  onOpen(event: Event, card: CreationView): void {
    if (!card.gated) return;
    event.preventDefault();
    void this.adultGate.open();
  }
}
