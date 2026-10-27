import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { nextActionLabel } from '@shared/utils/next-action.util';
import type { HomeFilter } from '../../data-access/home-discovery';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';
import { buttonClasses } from '@shared/ui/button/button';
import { formatRating } from '@shared/utils/collection-rating.util';
import { imageRendition } from '@shared/utils/image-rendition.util';

const PICKS = 3;

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

@Component({
  selector: 'shelfy-home-pick',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, ShelfSectionComponent],
  template: `
    @if (picks().length) {
      <shelfy-shelf-section
        [title]="'home.next_pick' | translate"
        [subtitle]="'home.next_pick_sub' | translate"
        [band]="true"
        [rail]="null"
      >
        @if (canShuffle()) {
          <button secTools type="button" class="v-more" (click)="shuffle()">
            <shelfy-icon name="shuffle" size="18" />
            {{ 'home.shuffle' | translate }}
          </button>
        }
        <div class="v-picks">
          @for (pick of picks(); track pick.item.id) {
            <article
              class="v-pick"
              tabindex="0"
              (click)="open(pick.route)"
              (keydown.enter)="open(pick.route)"
            >
              <span class="v-pick-art">
                @if (pick.cover; as cover) {
                  <img [src]="cover" alt="" loading="lazy" />
                }
              </span>
              <span class="v-pick-txt">
                <span class="v-sub">{{ pick.since }}</span>
                <b>{{ pick.item.media.title }}</b>
                <span class="v-meta"
                  >{{ pick.meta }}
                  @if (pick.rating; as rating) {
                    <i>·</i>
                    <span class="v-star"
                      ><shelfy-icon name="star" size="14" [active]="true" />{{ rating }}</span
                    >
                  }
                </span>
                <button
                  type="button"
                  [class]="startClass"
                  [disabled]="busy() === pick.item.id"
                  (click)="$event.stopPropagation(); start(pick.item)"
                >
                  <shelfy-icon name="play" size="18" [active]="true" />
                  {{ pick.verb }}
                </button>
              </span>
            </article>
          }
        </div>
      </shelfy-shelf-section>
    }
  `,
  host: { class: 'block' },
})
export class HomePickComponent {
  private readonly collection = inject(CollectionService);
  private readonly translate = inject(TranslateService);
  private readonly dateFormat = inject(DateFormatService);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);

  items = input.required<CollectionItemResponse[]>();
  filter = input<HomeFilter>('all');
  random = input<() => number>(Math.random);

  private readonly router = inject(Router);
  protected readonly startClass = buttonClasses({
    variant: 'primary',
    size: 'sm',
    extraClass: 'mt-3 self-start',
  });
  readonly busy = signal<string | null>(null);
  private readonly round = signal(0);

  readonly query = computed(() =>
    this.filter() === 'all' ? { status: 'planned' } : { status: 'planned', type: this.filter() },
  );

  readonly canShuffle = computed(() => this.items().length > PICKS);

  readonly picks = computed(() => {
    const lang = this.translate.lang();
    this.round();
    const items = shuffled(this.items(), this.random())
      .filter((item) => !!item.media.coverUrl)
      .slice(0, PICKS);
    return items.map((item) => {
      const date = item.media.metadata?.['releaseDate'];
      const year = typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : null;
      return {
        item,
        cover: imageRendition(item.media.coverUrl!, 'card'),
        route: ['/media', item.media.mediaType, item.media.externalId],
        meta: [this.translate.get('collection.media_type_one.' + item.media.mediaType), year]
          .filter(Boolean)
          .join(' · '),
        rating: item.rating ? formatRating(item.rating) : null,
        since: this.translate.get('home.backlog_since', {
          date: this.dateFormat.formatDate(new Date(item.createdAt), lang),
        }),
        verb: nextActionLabel('start', item.media.mediaType, null, (key, params) =>
          this.translate.get(key, params),
        ),
      };
    });
  });

  open(route: string[]): void {
    void this.router.navigate(route);
  }

  shuffle(): void {
    this.round.update((value) => value + 1);
  }

  start(item: CollectionItemResponse): void {
    if (this.busy()) return;
    this.busy.set(item.id);
    this.collection.update(item.id, { status: 'ongoing' }).subscribe({
      next: () => this.busy.set(null),
      error: (error: unknown) => {
        this.busy.set(null);
        catchAndToastError(this.toast, this.errorMessage)(error);
      },
    });
  }
}
