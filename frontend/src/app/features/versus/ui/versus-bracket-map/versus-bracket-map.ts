import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { VersusEntry, VersusMatchResponse } from '@app/core/services/versus/versus.model';
import { TranslatePipe } from '@app/shared/pipes/translate';

interface RoundColumn {
  round: number;
  labelKey: string;
  params: Record<string, number>;
  matches: VersusMatchResponse[];
}

@Component({
  selector: 'shelfy-versus-bracket-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-10">
      @for (column of columns(); track column.round) {
        <section [attr.aria-labelledby]="'bracket-round-' + column.round">
          <h3
            [id]="'bracket-round-' + column.round"
            class="font-display text-text text-[1.5rem] leading-none font-extrabold tracking-[-0.04em]"
          >
            {{ column.labelKey | translate: column.params }}
          </h3>
          <ol class="mt-4 grid gap-2 sm:grid-cols-2">
            @for (match of column.matches; track match.id) {
              @let current = match.id === currentMatchId();
              <li
                class="rounded-2xl p-2 transition-colors"
                [class]="
                  current
                    ? 'bg-accent/12 shadow-[inset_0_0_0_2px_rgb(230_211_179/0.5)]'
                    : 'bg-white/5'
                "
                [attr.aria-current]="current ? 'step' : null"
              >
                @for (entry of [match.entryA, match.entryB]; track $index) {
                  @if (entry) {
                    <div class="flex items-center gap-3 px-1 py-1">
                      <span
                        class="bg-surface-raised aspect-2/3 w-9 shrink-0 overflow-hidden rounded-lg"
                        [class.opacity-40]="lost(match, entry)"
                      >
                        @if (entry.coverUrl) {
                          <img
                            [src]="entry.coverUrl"
                            alt=""
                            loading="lazy"
                            class="size-full object-cover"
                          />
                        }
                      </span>
                      <span
                        class="min-w-0 flex-1 truncate text-[0.9375rem]"
                        [class]="
                          won(match, entry)
                            ? 'text-text font-semibold'
                            : lost(match, entry)
                              ? 'text-text-subtle'
                              : 'text-text-muted'
                        "
                        >{{ entry.title || ('adult.hidden' | translate) }}</span
                      >
                    </div>
                  } @else {
                    <p class="text-text-subtle px-1.5 py-2 text-sm">
                      {{ 'versus.play.bye' | translate }}
                    </p>
                  }
                }
              </li>
            }
          </ol>
        </section>
      }
    </div>
  `,
})
export class VersusBracketMapComponent {
  readonly matches = input.required<VersusMatchResponse[]>();
  readonly roundsTotal = input.required<number>();
  readonly currentMatchId = input<string | null>(null);

  readonly columns = computed<RoundColumn[]>(() => {
    const total = this.roundsTotal();
    const byRound = new Map<number, VersusMatchResponse[]>();
    for (const match of this.matches()) {
      byRound.set(match.round, [...(byRound.get(match.round) ?? []), match]);
    }
    return [...byRound.entries()]
      .sort(([a], [b]) => a - b)
      .map(([round, matches]) => ({
        round,
        labelKey:
          round === total
            ? 'versus.play.final'
            : round === total - 1
              ? 'versus.play.semi_final'
              : 'versus.play.round_of',
        params: { count: 2 ** (total - round + 1) },
        matches: matches.sort((a, b) => a.slotIndex - b.slotIndex),
      }));
  });

  won(match: VersusMatchResponse, entry: VersusEntry): boolean {
    return match.isDecided && match.winnerEntryId === entry.id;
  }

  lost(match: VersusMatchResponse, entry: VersusEntry): boolean {
    return match.isDecided && match.winnerEntryId !== entry.id;
  }
}
