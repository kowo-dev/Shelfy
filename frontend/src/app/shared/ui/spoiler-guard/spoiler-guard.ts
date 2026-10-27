import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ButtonComponent } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';

@Component({
  selector: 'shelfy-spoiler-guard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ButtonComponent, IconComponent],
  templateUrl: './spoiler-guard.html',
})
export class SpoilerGuardComponent {
  spoiler = input(false);
  resetKey = input<unknown>(null);
  interactive = input(true);

  readonly revealed = signal(false);

  constructor() {
    effect(() => {
      this.resetKey();
      this.revealed.set(false);
    });
  }

  reveal(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.revealed.set(true);
  }
}
