import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { VersusPodiumEntry } from '@app/core/services/versus/versus.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AdultBadgeComponent } from '@shared/ui/adult-badge/adult-badge';

@Component({
  selector: 'shelfy-versus-podium',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, TranslatePipe, AdultBadgeComponent],
  host: { class: 'block' },
  template: `
    <ol
      class="mx-auto grid grid-cols-3 items-end"
      [class]="compact() ? 'gap-3' : 'max-w-250 gap-[clamp(1rem,3vw,3rem)]'"
      [attr.aria-label]="label()"
    >
      @if (second(); as entry) {
        <li class="col-start-1 row-start-1 grid min-w-0 justify-items-center gap-3.5 text-center">
          <ng-container [ngTemplateOutlet]="cover" [ngTemplateOutletContext]="{ entry }" />
          <ng-container
            [ngTemplateOutlet]="caption"
            [ngTemplateOutletContext]="{ entries: [entry], place: 2 }"
          />
        </li>
      }
      @if (first(); as entry) {
        <li class="col-start-2 row-start-1 grid min-w-0 justify-items-center gap-3.5 text-center">
          <ng-container
            [ngTemplateOutlet]="cover"
            [ngTemplateOutletContext]="{ entry, winner: true }"
          />
          <ng-container
            [ngTemplateOutlet]="caption"
            [ngTemplateOutletContext]="{ entries: [entry], place: 1 }"
          />
        </li>
      }
      @if (thirds().length > 0) {
        <li class="col-start-3 row-start-1 grid min-w-0 justify-items-center gap-3.5 text-center">
          <div
            class="grid w-full gap-2"
            [class]="thirds().length > 1 ? 'grid-cols-2' : 'grid-cols-1'"
          >
            @for (entry of thirds(); track entry.entry.id) {
              <ng-container [ngTemplateOutlet]="cover" [ngTemplateOutletContext]="{ entry }" />
            }
          </div>
          <ng-container
            [ngTemplateOutlet]="caption"
            [ngTemplateOutletContext]="{ entries: thirds(), place: 3 }"
          />
        </li>
      }
    </ol>

    <ng-template #cover let-entry="entry" let-winner="winner">
      <div
        class="bg-surface-3 relative aspect-2/3 w-full overflow-hidden"
        [class]="
          (compact()
            ? 'shadow-poster rounded-xl'
            : 'rounded-[1.25rem] shadow-[0_40px_70px_-30px_#000]') +
          (winner
            ? ' ring-accent ring-3' +
              (compact() ? '' : ' -translate-y-9 shadow-[0_60px_100px_-36px_#000]')
            : '')
        "
      >
        @if (entry.entry.media?.isAdult && !entry.entry.title) {
          <span class="absolute inset-0 grid place-items-center">
            <shelfy-adult-badge size="2.5rem" />
          </span>
        } @else if (entry.entry.coverUrl) {
          <img
            [src]="entry.entry.coverUrl"
            alt=""
            class="size-full object-cover"
            draggable="false"
          />
        }
      </div>
    </ng-template>

    <ng-template #caption let-entries="entries" let-place="place">
      <span
        class="font-display text-accent leading-[0.8] font-extrabold tracking-[-0.06em]"
        [class]="
          (compact() ? 'text-[1.875rem]' : 'text-[clamp(2.75rem,4vw,4.5rem)]') +
          (place === 1 && !compact() ? ' -mt-9' : '')
        "
        aria-hidden="true"
        >{{ place }}</span
      >
      <span class="sr-only">{{
        (place === 3 && entries.length > 1
          ? 'versus.result.place_3_many'
          : 'versus.result.place_' + place
        ) | translate
      }}</span>
      @for (entry of entries; track entry.entry.id) {
        <span class="flex w-full min-w-0 flex-col items-center">
          <b
            class="text-text line-clamp-2 w-full font-bold text-balance"
            [class]="compact() ? 'text-sm' : 'text-[1.125rem] max-sm:text-sm'"
            >{{ entry.entry.title || ('adult.hidden' | translate) }}</b
          >
          @if (showCommunity()) {
            <span class="text-text-subtle mt-1 text-xs tabular-nums">
              @if (entry.communityRank) {
                {{ 'versus.result.community_rank' | translate: { rank: entry.communityRank } }}
              } @else {
                {{ 'versus.result.community_unranked' | translate }}
              }
            </span>
          }
        </span>
      }
    </ng-template>
  `,
})
export class VersusPodiumComponent {
  readonly podium = input.required<VersusPodiumEntry[]>();
  readonly label = input('');
  readonly compact = input(false);
  readonly showCommunity = input(true);

  readonly first = computed(() => this.podium().find((entry) => entry.place === 1) ?? null);
  readonly second = computed(() => this.podium().find((entry) => entry.place === 2) ?? null);
  readonly thirds = computed(() => this.podium().filter((entry) => entry.place === 3));
}
