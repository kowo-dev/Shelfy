import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { buttonClasses } from '@shared/ui/button/button';

export const AUTH_LINK_BUTTON = buttonClasses({ variant: 'primary', extraClass: 'mt-2' });
export const AUTH_MARK = 'bg-accent/14 text-accent grid size-18 place-items-center rounded-full';

@Component({
  selector: 'shelfy-auth-form-head',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  host: { class: 'contents' },
  template: `
    <div class="animate-rise-in stagger-1 mb-3 flex flex-col gap-4">
      <h1 class="heading-auth">{{ title() | translate }}</h1>
      <p class="text-text-muted text-base">{{ description() | translate }}</p>
    </div>
    @if (error()) {
      <p
        role="alert"
        class="bg-danger/10 text-danger-fg animate-rise-in flex items-start gap-2 rounded-lg px-4 py-3 text-sm"
      >
        <shelfy-icon name="errorCircle" size="sm" class="mt-0.5 shrink-0" />
        <span>{{ error() }}</span>
      </p>
    }
  `,
})
export class AuthFormHeadComponent {
  title = input.required<string>();
  description = input.required<string>();
  error = input('');
}
