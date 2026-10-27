import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeedService } from '@app/core/services/community/community';
import type { FeedItem } from '@app/core/services/community/community.model';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { ButtonComponent, buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { RatingValueComponent } from '@shared/ui/rating-value/rating-value';
import { staggerDelay } from '@shared/ui/ui-recipes';
import { ratingToTextColor } from '@shared/utils/collection-rating.util';
import { collectionStatusColor, statusLabelKey } from '@shared/utils/collection-status.util';
import { SpoilerGuardComponent } from '@shared/ui/spoiler-guard/spoiler-guard';
import { imageRendition } from '@shared/utils/image-rendition.util';
import { groupFeed } from './activity-feed.util';

const PAGE_SIZE = 20;

@Component({
  selector: 'shelfy-activity-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    ButtonComponent,
    IconComponent,
    RatingValueComponent,
    RouterLink,
    SpoilerGuardComponent,
    TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    @if (!loaded()) {
      <div class="flex max-w-180 flex-col" role="status" aria-busy="true">
        @for (slot of [0, 1, 2]; track slot) {
          <div class="flex gap-5 border-b border-white/7 py-5" aria-hidden="true">
            <span
              class="bg-fill-subtle aspect-2/3 w-24 shrink-0 rounded-[0.875rem] motion-safe:animate-pulse sm:w-28"
            ></span>
            <span class="flex flex-1 flex-col justify-center gap-3">
              <span class="bg-fill-subtle h-3 w-2/5 rounded-sm"></span>
              <span class="bg-fill-subtle h-6 w-3/5 rounded-sm"></span>
            </span>
          </div>
        }
      </div>
    } @else if (entries().length === 0) {
      <div class="flex max-w-xl flex-col items-start gap-2 py-12">
        <h2 class="font-display text-text text-[2rem] font-bold tracking-[-0.04em]">
          {{ 'feed.empty_title' | translate }}
        </h2>
        <p class="text-text-muted max-w-[56ch] text-base">{{ 'feed.empty_body' | translate }}</p>
      </div>
    } @else {
      <ol class="flex max-w-180 flex-col">
        @for (entry of entries(); track entry.id; let i = $index) {
          <li
            class="animate-rise-in border-b border-white/7 last:border-b-0"
            [style.animation-delay.ms]="stagger(i)"
          >
            <article class="flex items-center gap-5 py-5">
              <a
                class="bg-surface-3 relative aspect-2/3 w-24 shrink-0 overflow-hidden rounded-[0.875rem] shadow-[0_22px_40px_-18px_#000] transition-transform duration-300 hover:-translate-y-1.5 sm:w-28"
                [routerLink]="['/media', entry.media.mediaType, entry.media.externalId]"
                [attr.aria-label]="entry.media.title"
              >
                @if (entry.media.coverUrl; as cover) {
                  <img
                    [src]="rendition(cover)"
                    alt=""
                    loading="lazy"
                    draggable="false"
                    class="size-full object-cover"
                  />
                }
              </a>
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <p class="text-text-muted flex min-w-0 items-center gap-2 text-sm">
                  <a
                    class="text-text flex min-w-0 items-center gap-2 font-semibold hover:opacity-80"
                    [routerLink]="['/profile', entry.username]"
                  >
                    <shelfy-avatar
                      size="28"
                      [displayName]="entry.name"
                      [avatarUrl]="entry.avatarUrl"
                    />
                    <span class="truncate">{{ entry.name }}</span>
                  </a>
                  <span aria-hidden="true">·</span>
                  <time class="shrink-0 tabular-nums" [attr.datetime]="entry.createdAt">{{
                    when(entry.createdAt)
                  }}</time>
                  <span class="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5">
                    @for (key of entry.tags; track key) {
                      <span [class]="tagClass">{{ key | translate }}</span>
                    }
                  </span>
                </p>
                <a
                  class="font-display text-text line-clamp-2 text-[1.375rem] leading-[1.02] font-extrabold tracking-[-0.04em] text-balance hover:opacity-80 sm:text-[1.75rem]"
                  [routerLink]="['/media', entry.media.mediaType, entry.media.externalId]"
                  >{{ entry.media.title }}</a
                >
                @if (entry.rating !== null || entry.status) {
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    @if (entry.rating !== null) {
                      <span class="flex items-center gap-2 text-lg font-bold">
                        @if (entry.previous !== null) {
                          <shelfy-rating-value
                            class="text-text-subtle line-through decoration-2"
                            starSize="16"
                            [value]="entry.previous"
                          />
                          <shelfy-icon
                            name="chevronRight"
                            size="18"
                            class="text-text-subtle"
                            aria-hidden="true"
                          />
                        }
                        <shelfy-rating-value
                          starSize="18"
                          [value]="entry.rating"
                          [color]="ratingColor(entry.rating)"
                        />
                      </span>
                    }
                    @if (entry.status; as status) {
                      <span class="text-text flex items-center gap-2 text-base font-semibold">
                        <span
                          class="size-2.5 rounded-full"
                          [style.background]="statusColor(status)"
                          aria-hidden="true"
                        ></span>
                        {{ statusLabel(status, entry.media.mediaType) | translate }}
                      </span>
                    }
                  </div>
                }
                @if (entry.excerpt; as excerpt) {
                  <shelfy-spoiler-guard [spoiler]="entry.spoiler" [interactive]="false">
                    <p class="text-text-muted line-clamp-3 text-[0.9375rem] leading-relaxed">
                      {{ excerpt }}
                    </p>
                  </shelfy-spoiler-guard>
                }
                @if (entry.reviewId; as reviewId) {
                  <a [class]="actionButton + ' mt-1 w-fit'" [routerLink]="['/reviews', reviewId]">
                    <shelfy-icon name="reviews" size="16" />
                    {{ 'feed.read_review' | translate }}
                  </a>
                }
              </div>
            </article>
          </li>
        }
      </ol>
      @if (nextBefore()) {
        <div class="mt-10 flex max-w-180 justify-center">
          <shelfy-button
            type="button"
            variant="secondary"
            [loading]="loading()"
            [disabled]="loading()"
            (click)="loadMore()"
          >
            {{ 'friends.load_more' | translate }}
          </shelfy-button>
        </div>
      }
    }
  `,
})
export class ActivityFeedComponent {
  private readonly feed = inject(FeedService);
  private readonly dates = inject(DateFormatService);
  private readonly translate = inject(TranslateService);

  protected readonly stagger = staggerDelay;
  protected readonly actionButton = buttonClasses({ variant: 'secondary', size: 'sm' });
  protected readonly statusColor = collectionStatusColor;
  protected readonly statusLabel = statusLabelKey;
  protected readonly tagClass =
    'bg-fill-subtle text-accent inline-flex h-7.5 items-center rounded-[10px] px-[11px] text-[13px] font-semibold whitespace-nowrap';
  protected readonly ratingColor = (rating: number) => ratingToTextColor(rating, 100);
  protected readonly rendition = (url: string) => imageRendition(url, 'card');

  private readonly items = signal<FeedItem[]>([]);
  readonly entries = computed(() => groupFeed(this.items()));
  readonly nextBefore = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly loading = signal(false);

  constructor() {
    this.fetch(null);
  }

  loadMore(): void {
    const before = this.nextBefore();
    if (before && !this.loading()) this.fetch(before);
  }

  when(date: string): string {
    return this.dates.formatRelative(new Date(date), this.translate.lang());
  }

  private fetch(before: string | null): void {
    this.loading.set(true);
    this.feed.page(before, PAGE_SIZE).subscribe({
      next: (page) => {
        this.items.update((items) => [...items, ...page.items]);
        this.nextBefore.set(page.nextBefore);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.loaded.set(true);
        this.loading.set(false);
      },
    });
  }
}
