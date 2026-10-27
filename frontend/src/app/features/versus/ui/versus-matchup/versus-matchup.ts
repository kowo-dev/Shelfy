import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { VersusEntry } from '@app/core/services/versus/versus.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { DialogComponent } from '@shared/ui/dialog/dialog';
import { buttonClasses } from '@shared/ui/button/button';
import { ClipPlayerComponent } from '../clip-player/clip-player';
import { ClipPlaybackService } from '../clip-player/clip-playback';
import { versusOverview, versusYear } from '../versus-art.util';

const PICK_DELAY_MS = 650;

type Side = 0 | 1;

@Component({
  selector: 'shelfy-versus-matchup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ClipPlayerComponent, DialogComponent],
  templateUrl: './versus-matchup.html',
  styleUrl: './versus-matchup.css',
  host: { class: 'block', '(document:keydown)': 'onKeydown($event)' },
})
export class VersusMatchupComponent {
  private readonly playback = inject(ClipPlaybackService);

  entryA = input.required<VersusEntry | null>();
  entryB = input.required<VersusEntry | null>();
  disabled = input(false);

  picked = output<string>();
  focused = output<VersusEntry | null>();

  protected readonly sides = computed(() => [this.entryA(), this.entryB()] as const);
  protected readonly video = computed(() => !!(this.entryA()?.clip || this.entryB()?.clip));
  protected readonly chosen = signal<Side | null>(null);
  protected readonly previewing = signal<Side | null>(null);
  protected readonly locked = computed(() => this.disabled() || this.chosen() !== null);

  protected readonly previewEntry = computed(() => {
    const side = this.previewing();
    return side === null ? null : this.sides()[side];
  });

  protected readonly chooseButton = buttonClasses({ variant: 'primary', block: true });
  protected readonly choosePill = buttonClasses({
    variant: 'primary',
    size: 'sm',
    extraClass: 'shrink-0',
  });

  protected readonly touch = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;

  protected side(index: number): Side {
    return index === 0 ? 0 : 1;
  }

  protected year(side: Side): string | null {
    return versusYear(this.sides()[side]?.media ?? null);
  }

  protected overview(side: Side): string | null {
    return versusOverview(this.sides()[side]?.media ?? null);
  }

  protected focusSide(side: Side | null): void {
    if (this.chosen() !== null) return;
    this.focused.emit(side === null ? null : this.sides()[side]);
  }

  pick(entry: VersusEntry | null): void {
    if (this.disabled() || !entry || this.chosen() !== null) return;
    this.playback.active.set(null);
    this.previewing.set(null);
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? true;
    if (reduced) {
      this.picked.emit(entry.id);
      return;
    }
    this.chosen.set(this.sides()[0]?.id === entry.id ? 0 : 1);
    this.focused.emit(entry);
    setTimeout(() => this.picked.emit(entry.id), PICK_DELAY_MS);
  }

  protected posterTap(side: Side): void {
    const entry = this.sides()[side];
    if (!entry || this.locked()) return;
    if (!this.touch) {
      this.pick(entry);
      return;
    }
    this.previewing.set(side);
    this.focused.emit(entry);
  }

  protected closePreview(): void {
    this.previewing.set(null);
    this.focused.emit(null);
  }

  protected pickPreviewed(): void {
    const side = this.previewing();
    if (side !== null) this.pick(this.sides()[side]);
  }

  protected isPlaying(entry: VersusEntry | null): boolean {
    return !!entry && this.playback.active() === entry.id;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || this.previewing() !== null) return;
    if (event.key === 'ArrowLeft') this.pick(this.entryA());
    else if (event.key === 'ArrowRight') this.pick(this.entryB());
  }
}
