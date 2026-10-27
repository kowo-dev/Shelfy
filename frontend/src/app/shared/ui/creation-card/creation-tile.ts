import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import type {
  MediaListResponse,
  MediaListSummaryResponse,
} from '@app/core/services/lists/lists.model';
import { TranslateService } from '@app/core/services/translate/translate';
import type { VersusPoolSummaryResponse } from '@app/core/services/versus/versus.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AdultBadgeComponent } from '@shared/ui/adult-badge/adult-badge';
import { IconComponent } from '@shared/ui/icon/icon';
import { SocialCountsComponent } from '@shared/ui/social-counts/social-counts';
import { creationView, type CreationView } from './creation-view';

const VISIBILITY_ICON = { public: 'eye', link: 'link', private: 'lock' } as const;

@Component({
  selector: 'shelfy-creation-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, AdultBadgeComponent, IconComponent, SocialCountsComponent],
  template: `
    @if (view(); as card) {
      <a [routerLink]="card.route" class="group/lc block w-full">
        @if (card.kind === 'versus') {
          <span
            class="ease-expo relative grid aspect-4/3 gap-1.5 transition-transform duration-700 group-hover/lc:-translate-y-1.5 motion-reduce:transition-none"
            [style.grid-template-columns]="'repeat(' + columns() + ', minmax(0, 1fr))'"
          >
            @for (cover of card.covers; track $index) {
              <span class="bg-surface-2 shadow-poster overflow-hidden rounded-[0.875rem]">
                @if (cover.adult) {
                  <span class="grid size-full place-items-center">
                    <shelfy-adult-badge size="2rem" />
                  </span>
                } @else if (cover.url) {
                  <img
                    [src]="cover.url"
                    alt=""
                    class="size-full object-cover"
                    loading="lazy"
                    (error)="$any($event.target).style.visibility = 'hidden'"
                  />
                } @else {
                  <span
                    class="font-display text-text-subtle grid size-full place-items-center p-3 text-center text-sm font-bold text-balance"
                    >{{ cover.title }}</span
                  >
                }
              </span>
            } @empty {
              <span class="text-text-subtle grid size-full place-items-center" aria-hidden="true">
                <shelfy-icon name="compare" size="lg" />
              </span>
            }
            @if (card.covers.length === 2) {
              <i
                class="font-display bg-bar text-brand absolute top-1/2 left-1/2 grid size-13.5 -translate-1/2 place-items-center rounded-full text-lg font-extrabold tracking-[-0.03em] not-italic shadow-[0_0_0_5px_var(--color-bar)]"
                aria-hidden="true"
                >vs</i
              >
            }
          </span>
        } @else {
          <span
            class="ease-expo relative block aspect-4/3 transition-transform duration-700 group-hover/lc:-translate-y-1.5 motion-reduce:transition-none"
          >
            @for (cover of card.covers; track $index; let index = $index) {
              <span
                class="bg-surface-2 ease-expo absolute inset-y-0 aspect-2/3 overflow-hidden rounded-[0.875rem] shadow-[14px_0_30px_-14px_rgb(0_0_0/0.9)] transition-transform duration-700 group-hover/lc:translate-x-[calc(var(--i)*3%)] motion-reduce:transition-none"
                [style.left.%]="index * 16"
                [style.z-index]="10 - index"
                [style.--i]="index"
              >
                @if (cover.adult) {
                  <span class="grid size-full place-items-center">
                    <shelfy-adult-badge size="2rem" />
                  </span>
                } @else if (cover.url) {
                  <img
                    [src]="cover.url"
                    alt=""
                    class="size-full object-cover"
                    loading="lazy"
                    (error)="$any($event.target).style.visibility = 'hidden'"
                  />
                } @else {
                  <span
                    class="font-display text-text-subtle grid size-full place-items-center p-3 text-center text-sm font-bold text-balance"
                    >{{ cover.title }}</span
                  >
                }
              </span>
            } @empty {
              <span
                class="bg-surface-2 text-text-subtle rounded-tile grid size-full place-items-center"
                aria-hidden="true"
              >
                <shelfy-icon name="lists" size="lg" />
              </span>
            }
          </span>
        }
        <b
          class="font-display text-text mt-4 block truncate text-lg font-bold tracking-[-0.03em]"
          >{{ card.title }}</b
        >
        <span class="mt-1.5 flex min-w-0 items-center gap-3">
          <small class="text-text-subtle flex min-w-0 flex-1 items-center gap-1 text-sm">
            <span class="min-w-0 truncate">{{
              (card.kind === 'versus' ? 'home.versus_by' : 'home.list_by')
                | translate: { name: card.creator ?? '' }
            }}</span>
            @if (date(); as when) {
              <span class="shrink-0 tabular-nums">· {{ when }}</span>
            }
            @if (showVisibility() && card.visibility; as visibility) {
              <span
                class="ml-1 inline-flex shrink-0 items-center"
                [title]="'community.visibility.' + visibility | translate"
              >
                <shelfy-icon [name]="visibilityIcon[visibility]" size="14" />
                <span class="sr-only">{{ 'community.visibility.' + visibility | translate }}</span>
              </span>
            }
          </small>
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
export class CreationTileComponent {
  private readonly dates = inject(DateFormatService);
  private readonly translate = inject(TranslateService);

  readonly list = input<MediaListSummaryResponse | MediaListResponse | null>(null);
  readonly pool = input<VersusPoolSummaryResponse | null>(null);
  readonly showVisibility = input(false);
  readonly dated = input(false);

  protected readonly visibilityIcon = VISIBILITY_ICON;

  readonly view = computed<CreationView | null>(() =>
    creationView({ list: this.list(), pool: this.pool() }),
  );

  readonly columns = computed(() => Math.max(1, this.view()?.covers.length ?? 1));

  readonly date = computed(() => {
    const source = this.list() ?? this.pool();
    return this.dated() && source
      ? this.dates.formatRelative(new Date(source.updatedAt), this.translate.lang())
      : null;
  });
}
