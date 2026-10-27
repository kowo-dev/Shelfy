import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';

@Component({
  selector: 'shelfy-volume-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent],
  template: `
    <div
      class="text-text-muted hover:text-text inline-flex h-13 items-center gap-3 rounded-2xl bg-white/8 pr-4.5 pl-1.5 backdrop-blur-xl transition-colors hover:bg-white/12"
      [style.--level]="(muted() ? 0 : value()) + '%'"
    >
      <button
        type="button"
        class="grid size-10 cursor-pointer place-items-center rounded-xl transition-[background-color,scale] hover:bg-white/8 active:scale-[0.94]"
        [attr.aria-label]="(silent() ? 'volume.unmute' : 'volume.mute') | translate"
        [attr.aria-pressed]="muted()"
        (click)="mutedChange.emit(!muted())"
      >
        <shelfy-icon [name]="icon()" size="16" />
      </button>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        class="h-1 w-24 cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,var(--color-text)_var(--level),var(--color-fill-strong)_var(--level))] focus-visible:outline-none [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white focus-visible:[&::-moz-range-thumb]:shadow-[0_0_0_3px_var(--color-brand-ink)] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_3px_var(--color-brand-ink)]"
        [attr.aria-label]="'volume.label' | translate"
        [value]="muted() ? 0 : value()"
        (input)="onInput($event)"
      />
      <span class="w-7 text-right text-[0.9375rem] font-semibold tabular-nums">{{
        muted() ? 0 : value()
      }}</span>
    </div>
  `,
})
export class VolumeControlComponent {
  value = input.required<number>();
  muted = input(false);

  valueChange = output<number>();
  mutedChange = output<boolean>();

  protected readonly silent = computed(() => this.muted() || this.value() === 0);
  protected readonly icon = computed(() =>
    this.silent() ? 'soundOff' : this.value() < 50 ? 'soundLow' : 'soundOn',
  );

  protected onInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.valueChange.emit(value);
    if (this.muted() && value > 0) this.mutedChange.emit(false);
  }
}
