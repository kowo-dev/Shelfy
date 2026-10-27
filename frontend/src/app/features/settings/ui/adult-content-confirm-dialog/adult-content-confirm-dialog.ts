import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ButtonComponent } from '@app/shared/ui/button/button';
import { DialogComponent } from '@app/shared/ui/dialog/dialog';

@Component({
  selector: 'shelfy-adult-content-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DialogComponent, ButtonComponent],
  templateUrl: './adult-content-confirm-dialog.html',
})
export class AdultContentConfirmDialogComponent {
  open = input.required<boolean>();

  closed = output<void>();
  confirm = output<void>();
}
