import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';

@Component({
  selector: 'shelfy-selection-remove',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  host: { class: 'contents' },
  template: `
    <button
      type="button"
      [class]="danger"
      [disabled]="count() === 0"
      [attr.aria-label]="'edit.selection.remove' | translate"
      (click)="remove.emit()"
    >
      <shelfy-icon name="trash" size="sm" />
      <span class="max-sm:hidden">{{ 'edit.selection.remove' | translate }}</span>
    </button>
    <button
      type="button"
      [class]="close"
      [attr.aria-label]="'collection.bulk.exit_button' | translate"
      [title]="'collection.bulk.exit_button' | translate"
      (click)="exit.emit()"
    >
      <shelfy-icon name="close" size="sm" />
    </button>
  `,
})
export class SelectionRemoveComponent {
  count = input.required<number>();
  readonly remove = output<void>();
  readonly exit = output<void>();

  readonly danger = buttonClasses({
    variant: 'secondary',
    extraClass: 'max-sm:size-10 max-sm:px-0',
  });
  readonly close = buttonClasses({ variant: 'secondary', iconOnly: true });
}
