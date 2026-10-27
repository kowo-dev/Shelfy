import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ButtonComponent } from '@shared/ui/button/button';
import { DialogComponent } from '@shared/ui/dialog/dialog';

@Component({
  selector: 'shelfy-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent, TranslatePipe],
  template: `
    <shelfy-dialog
      [open]="confirm.message() !== null"
      [title]="confirm.options().title ?? ('dialog.confirm_title' | translate)"
      (closed)="confirm.dismiss()"
    >
      <p class="text-text-muted">{{ confirm.message() }}</p>
      @if (confirm.options().url; as url) {
        <p
          class="text-text mt-4 rounded-2xl bg-white/8 px-4 py-3 text-base font-semibold break-all select-all"
        >
          {{ url }}
        </p>
      }

      <div dialogFooter class="contents">
        <shelfy-button type="button" variant="secondary" (click)="confirm.answer(false)">
          {{ confirm.options().cancelLabel ?? ('dialog.stay' | translate) }}
        </shelfy-button>
        <shelfy-button
          type="button"
          [variant]="confirm.options().destructive ? 'danger' : 'primary'"
          [disabled]="remaining() > 0"
          (click)="confirm.answer(true)"
        >
          {{ confirm.options().confirmLabel ?? ('dialog.leave' | translate) }}
          @if (remaining() > 0) {
            <span class="tabular-nums">({{ remaining() }})</span>
          }
        </shelfy-button>
      </div>
    </shelfy-dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly confirm = inject(ConfirmService);
  readonly remaining = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const open = this.confirm.message() !== null;
      const delay = this.confirm.options().delaySeconds ?? 0;
      untracked(() => this.start(open ? delay : 0));
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private start(seconds: number): void {
    this.stop();
    this.remaining.set(seconds);
    if (seconds <= 0) return;
    this.timer = setInterval(() => {
      this.remaining.update((left) => left - 1);
      if (this.remaining() <= 0) this.stop();
    }, 1000);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
