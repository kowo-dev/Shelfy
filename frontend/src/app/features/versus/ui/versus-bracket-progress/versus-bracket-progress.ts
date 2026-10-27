import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';

@Component({
  selector: 'shelfy-versus-bracket-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent],
  templateUrl: './versus-bracket-progress.html',
})
export class VersusBracketProgressComponent {
  currentRound = input.required<number>();
  roundsTotal = input.required<number>();
  bracketSize = input.required<number>();
  matchSlotIndex = input.required<number>();

  choicesRemaining = computed(() => {
    const matchesInRound = this.bracketSize() / 2 ** this.currentRound();
    return Math.max(1, Math.round(matchesInRound) - this.matchSlotIndex());
  });
}
