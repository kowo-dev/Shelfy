import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { CHIP, CHIP_OFF, CHIP_ON } from '@shared/ui/ui-recipes';

@Component({
  selector: 'shelfy-selection-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  host: { class: 'contents' },
  template: `
    <button
      type="button"
      [class]="chip() ? chipClass + ' ' + (pressed() ? chipOn : chipOff) : classes"
      [attr.aria-pressed]="pressed()"
      [disabled]="disabled()"
      [attr.aria-label]="'collection.bulk.select_button' | translate"
      (click)="toggled.emit()"
    >
      <shelfy-icon name="checkCircle" [size]="chip() ? '16' : 'sm'" />
      <span [class.max-sm:hidden]="!chip()">{{ 'collection.bulk.select_button' | translate }}</span>
    </button>
  `,
})
export class SelectionToggleComponent {
  pressed = input.required<boolean>();
  disabled = input(false);
  chip = input(false);
  readonly toggled = output<void>();

  protected readonly chipClass = CHIP;
  protected readonly chipOn = CHIP_ON;
  protected readonly chipOff = CHIP_OFF;

  readonly classes = buttonClasses({
    variant: 'secondary',
    extraClass: 'shrink-0 max-sm:w-11 max-sm:px-0',
  });
}
