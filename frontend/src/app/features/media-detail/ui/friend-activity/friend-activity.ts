import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { buttonClasses } from '@shared/ui/button/button';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';
import { collectionStatusColor, statusLabelKey } from '@shared/utils/collection-status.util';
import { mediaLogKind } from '@shared/utils/media-log-kind.util';
import { AuthService } from '@app/core/services/auth/auth';
import type { MediaType } from '@app/core/services/collection/collection.model';
import { PeopleService } from '@app/core/services/people/people';
import type { FollowedMediaActivity } from '@app/core/services/people/people.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { RatingValueComponent } from '@shared/ui/rating-value/rating-value';
import { SideSheetComponent } from '@shared/ui/side-sheet/side-sheet';

const STACKED = 4;

@Component({
  selector: 'shelfy-friend-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, RatingValueComponent, RouterLink, SideSheetComponent, TranslatePipe],
  host: { class: 'contents' },
  template: `
    @if (friends().length > 0) {
      <div class="flex flex-col gap-3">
        @if (label(); as text) {
          <p class="font-display text-text text-lg font-bold">{{ text }}</p>
        }
        <button
          type="button"
          [class]="buttonClass"
          aria-haspopup="dialog"
          [attr.aria-label]="summary()"
          (click)="sheetOpen.set(true)"
        >
          <span class="flex shrink-0 gap-1" aria-hidden="true">
            @for (friend of stacked(); track friend.username) {
              <shelfy-avatar
                size="28"
                [displayName]="friend.displayName || friend.username"
                [avatarUrl]="friend.avatarUrl"
              />
            }
            @if (hidden() > 0) {
              <span
                class="bg-fill-strong text-text grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums"
                >+{{ hidden() }}</span
              >
            }
          </span>
          <span class="max-w-48 truncate max-sm:hidden" aria-hidden="true">{{ names() }}</span>
          @if (average(); as avg) {
            <shelfy-rating-value
              class="font-bold"
              aria-hidden="true"
              [value]="avg"
              [color]="ratingColor(avg)"
              starSize="18"
            />
          }
        </button>
      </div>
    }

    @if (sheetOpen()) {
      <shelfy-side-sheet
        [title]="'media.friends.title' | translate"
        (closed)="sheetOpen.set(false)"
      >
        <ul class="flex flex-col gap-1">
          @for (friend of friends(); track friend.username) {
            <li>
              <a
                [routerLink]="['/profile', friend.username]"
                class="hover:bg-fill-subtle -mx-3 flex items-center gap-4 rounded-lg px-3 py-2.5 outline-offset-2 transition-colors"
                (click)="sheetOpen.set(false)"
              >
                <shelfy-avatar
                  size="md"
                  [displayName]="friend.displayName || friend.username"
                  [avatarUrl]="friend.avatarUrl"
                />
                <span class="flex min-w-0 flex-1 flex-col gap-1">
                  <span class="text-text truncate text-base font-semibold">{{
                    friend.displayName || friend.username
                  }}</span>
                  <span class="text-text-subtle flex min-w-0 items-center gap-1.5 text-sm">
                    <span
                      class="size-2 shrink-0 rounded-full"
                      [style.background]="statusColor(friend.status)"
                      aria-hidden="true"
                    ></span>
                    <span class="text-text-muted shrink-0 font-medium">{{ subline(friend) }}</span>
                    <span aria-hidden="true">·</span>
                    <span class="truncate tabular-nums">{{ when(friend.updatedAt) }}</span>
                  </span>
                </span>
                @if (friend.rating !== null) {
                  <shelfy-rating-value
                    class="text-xl font-bold"
                    [value]="friend.rating"
                    [color]="ratingColor(friend.rating)"
                    starSize="20"
                  />
                }
              </a>
            </li>
          }
        </ul>
      </shelfy-side-sheet>
    }
  `,
})
export class FriendActivityComponent {
  private readonly auth = inject(AuthService);
  private readonly peopleService = inject(PeopleService);
  private readonly translate = inject(TranslateService);
  private readonly dates = inject(DateFormatService);

  protected readonly buttonClass = buttonClasses({ variant: 'secondary', extraClass: 'gap-2.5' });
  protected readonly statusColor = collectionStatusColor;
  protected readonly ratingColor = (rating: number) => ratingToTextColor(rating, 100);

  readonly provider = input.required<string>();
  readonly mediaType = input.required<MediaType>();
  readonly externalId = input.required<string>();
  readonly label = input<string | null>(null);

  readonly friends = signal<FollowedMediaActivity[]>([]);
  readonly sheetOpen = signal(false);

  readonly stacked = computed(() =>
    [...this.friends()]
      .sort((a, b) => Number(b.rating !== null) - Number(a.rating !== null))
      .slice(0, STACKED),
  );
  readonly hidden = computed(() => this.friends().length - this.stacked().length);

  readonly names = computed(() => {
    const lang = this.translate.lang();
    const names = this.stacked()
      .slice(0, 2)
      .map((f) => f.displayName || f.username);
    const rest = this.friends().length - names.length;
    if (rest > 0) names.push(this.translate.get('media.friend_awards.others', { count: rest }));
    return new Intl.ListFormat(lang, { type: 'conjunction' }).format(names);
  });

  readonly average = computed(() => {
    const ratings = this.friends()
      .map((f) => f.rating)
      .filter((r): r is number => r !== null);
    if (ratings.length === 0) return null;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  });

  constructor() {
    effect((onCleanup) => {
      this.friends.set([]);
      if (!this.auth.isAuthenticated()) return;
      const subscription = this.peopleService
        .onMedia(this.provider(), this.mediaType(), this.externalId())
        .subscribe({
          next: (friends) => this.friends.set(friends),
          error: () => this.friends.set([]),
        });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  readonly summary = computed(() => {
    const avg = this.average();
    const text = `${this.names()} ${this.translate.get('media.friends.have_it', { count: this.friends().length })}`;
    return avg === null
      ? text
      : `${text} · ${this.translate.get('media.friends.average')} ${formatRating(avg)}`;
  });

  when(date: string): string {
    return this.dates.formatRelative(new Date(date), this.translate.lang());
  }

  subline(friend: FollowedMediaActivity): string {
    const status = this.translate.get(statusLabelKey(friend.status, this.mediaType()));
    if (friend.viewCount < 2) return status;
    const views = this.translate.get(`media.friends.views.${mediaLogKind(this.mediaType())}`, {
      count: friend.viewCount,
    });
    return `${status} · ${views}`;
  }
}
