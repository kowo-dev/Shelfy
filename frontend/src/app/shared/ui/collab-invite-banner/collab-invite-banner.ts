import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';

@Component({
  selector: 'shelfy-collab-invite-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  host: {
    class:
      'bg-fill-subtle mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg py-3 pr-3 pl-5',
  },
  template: `
    <p class="text-text text-base font-medium">{{ message() | translate }}</p>
    <div class="flex items-center gap-2">
      <button type="button" [class]="primary" [disabled]="answering()" (click)="accept.emit()">
        {{ 'lists.collab.accept' | translate }}
      </button>
      <button type="button" [class]="secondary" [disabled]="answering()" (click)="decline.emit()">
        {{ 'lists.collab.decline' | translate }}
      </button>
    </div>
  `,
})
export class CollabInviteBannerComponent {
  readonly message = input.required<string>();
  readonly answering = input(false);
  readonly accept = output<void>();
  readonly decline = output<void>();

  protected readonly primary = buttonClasses({ variant: 'primary' });
  protected readonly secondary = buttonClasses({ variant: 'secondary' });
}
