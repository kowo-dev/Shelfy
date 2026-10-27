import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { DangerAction } from '../../state/settings-danger-zone-state';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ButtonComponent } from '@app/shared/ui/button/button';
import { DialogComponent } from '@app/shared/ui/dialog/dialog';
import { InputComponent } from '@app/shared/ui/input/input';

@Component({
  selector: 'shelfy-danger-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, ButtonComponent],
  templateUrl: './danger-confirm-dialog.html',
})
export class DangerConfirmDialogComponent {
  open = input.required<boolean>();
  action = input.required<DangerAction | null>();
  confirmControl = input.required<FormControl<string>>();
  passwordControl = input<FormControl<string> | null>(null);
  username = input<string | null>(null);
  busy = input.required<boolean>();
  confirmMatches = input.required<boolean>();

  closed = output<void>();
  confirm = output<void>();
}
