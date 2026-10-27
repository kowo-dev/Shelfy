import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { buttonClasses } from '@shared/ui/button/button';
import { FLOATING_BAR } from '@shared/ui/ui-recipes';

export type EditBarState = 'idle' | 'saving' | 'saved';

@Component({
  selector: 'shelfy-edit-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent],
  template: `
    @if (visible()) {
      <div [class]="bar" animate.enter="animate-rise-in" animate.leave="animate-fade-out">
        <p class="text-text-muted min-w-0 truncate text-sm" aria-live="polite">{{ hint() }}</p>
        <div class="flex shrink-0 items-center gap-2">
          @if (!autosave() || closable()) {
            <button
              type="button"
              [class]="pill"
              [disabled]="state() !== 'idle'"
              (click)="cancelRequested.emit()"
            >
              {{ cancelLabel() }}
            </button>
          }
          <button
            type="button"
            [class]="primary"
            [disabled]="!canSave() || state() !== 'idle'"
            (click)="saveRequested.emit()"
          >
            @switch (state()) {
              @case ('saving') {
                <shelfy-spinner size="sm" />
              }
              @case ('saved') {
                <shelfy-icon name="check" size="sm" />
              }
            }
            {{ state() === 'saved' ? savedLabel() : saveLabel() }}
          </button>
        </div>
      </div>
    }
  `,
})
export class EditBarComponent {
  visible = input(true);
  hint = input<string | null>(null);
  canSave = input(true);
  state = input<EditBarState>('idle');
  autosave = input(false);
  closable = input(false);
  cancelLabel = input.required<string>();
  saveLabel = input.required<string>();
  savedLabel = input.required<string>();

  cancelRequested = output<void>();
  saveRequested = output<void>();

  protected readonly bar = FLOATING_BAR + ' justify-between gap-3 py-2 pr-2 pl-6';
  protected readonly pill = buttonClasses({ variant: 'secondary' });
  protected readonly primary = buttonClasses({ variant: 'primary' });
}
