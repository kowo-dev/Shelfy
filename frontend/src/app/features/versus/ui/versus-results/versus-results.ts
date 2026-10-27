import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { VersusMediaRankingEntry } from '@app/core/services/versus/versus.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { MediaCardComponent } from '@shared/ui/media-card/media-card';
import { CHIP, CHIP_OFF, collapse } from '@shared/ui/ui-recipes';
import { toPlaceholderCollectionItem } from '@shared/utils/media-placeholder-item.util';
import { ClipPlayerComponent } from '../clip-player/clip-player';
import { ClipVolumeComponent } from '../clip-player/clip-volume';

const TOP = 10;
const GRID = 'v-lgrid';
const WIDE_GRID = 'grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3';

@Component({
  selector: 'shelfy-versus-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    NgTemplateOutlet,
    MediaCardComponent,
    ClipPlayerComponent,
    ClipVolumeComponent,
  ],
  template: `
    <h2 class="sr-only">{{ 'versus.detail.results_title' | translate }}</h2>
    @if (wide()) {
      <div class="mb-5 flex justify-end">
        <shelfy-clip-volume />
      </div>
    }
    <ol [class]="gridClass()" [attr.start]="offset() + 1">
      @for (entry of top(); track entry.entry.id; let i = $index) {
        <ng-container
          [ngTemplateOutlet]="cell"
          [ngTemplateOutletContext]="{ entry, rank: offset() + i + 1 }"
        />
      }
    </ol>
    @if (rest().length > 0) {
      <div [class]="collapse(expanded())" [attr.inert]="expanded() ? null : ''">
        <ol class="overflow-hidden pt-9" [class]="gridClass()" [attr.start]="offset() + TOP + 1">
          @for (entry of rest(); track entry.entry.id; let i = $index) {
            <ng-container
              [ngTemplateOutlet]="cell"
              [ngTemplateOutletContext]="{ entry, rank: offset() + TOP + i + 1 }"
            />
          }
        </ol>
      </div>
      <button
        type="button"
        class="mt-10"
        [class]="pill"
        [attr.aria-expanded]="expanded()"
        (click)="expanded.set(!expanded())"
      >
        {{
          expanded()
            ? ('versus.detail.see_less' | translate)
            : ('versus.detail.see_all' | translate: { count: offset() + entries().length })
        }}
      </button>
    }

    <ng-template #cell let-entry="entry" let-rank="rank">
      @if (wide()) {
        <li class="v-tile min-w-0 cursor-default">
          <span class="v-art">
            @if (entry.entry.coverUrl) {
              <img [src]="entry.entry.coverUrl" alt="" loading="lazy" />
            }
            <shelfy-clip-player [key]="'rank-' + entry.entry.id" [clip]="entry.entry.clip" />
          </span>
          <ng-container
            [ngTemplateOutlet]="rankRow"
            [ngTemplateOutletContext]="{ entry, rank, author: entry.entry.clip.author }"
          />
        </li>
      } @else if (entry.entry.media; as media) {
        <li class="min-w-0">
          <shelfy-media-card [item]="placeholder(media)" [rank]="rank" [subtitle]="stats(entry)" />
        </li>
      } @else {
        <li class="v-poster min-w-0 cursor-default">
          <span class="v-art">
            @if (entry.entry.coverUrl) {
              <img [src]="entry.entry.coverUrl" alt="" loading="lazy" />
            }
          </span>
          <ng-container
            [ngTemplateOutlet]="rankRow"
            [ngTemplateOutletContext]="{ entry, rank, author: null }"
          />
        </li>
      }
    </ng-template>

    <ng-template #rankRow let-entry="entry" let-rank="rank" let-author="author">
      <div class="v-rk-row">
        <span class="rk" [class.top]="rank <= 3">{{ rank }}</span>
        <div>
          <b>{{ entry.entry.title }}</b>
          <span class="tabular-nums"
            >{{ stats(entry) }}
            @if (author) {
              · {{ author }}
            }
          </span>
        </div>
      </div>
    </ng-template>
  `,
  host: { class: 'block' },
})
export class VersusResultsComponent {
  private readonly translate = inject(TranslateService);

  entries = input.required<readonly VersusMediaRankingEntry[]>();
  offset = input(0);

  protected readonly TOP = TOP;
  protected readonly wide = computed(
    () => this.entries().length > 0 && this.entries().every((entry) => !!entry.entry.clip),
  );
  protected readonly gridClass = computed(() => (this.wide() ? WIDE_GRID : GRID));
  protected readonly collapse = collapse;
  protected readonly pill = `${CHIP} ${CHIP_OFF}`;
  protected readonly placeholder = toPlaceholderCollectionItem;
  protected readonly top = computed(() => this.entries().slice(0, TOP));
  protected readonly rest = computed(() => this.entries().slice(TOP));
  protected readonly expanded = signal(false);

  stats(entry: VersusMediaRankingEntry): string {
    return this.translate.get('versus.detail.stat_line', {
      winRate: (entry.winRate * 100).toFixed(0),
      appearances: entry.appearances,
    });
  }
}
