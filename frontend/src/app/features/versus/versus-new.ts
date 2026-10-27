import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { VersusService } from '@app/core/services/versus/versus';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';

@Component({
  selector: 'shelfy-versus-new-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  template: `
    <main class="grid min-h-full place-items-center pt-(--nav-bar-height)" aria-busy="true">
      <shelfy-spinner />
    </main>
  `,
})
export class VersusNewPageComponent {
  private readonly router = inject(Router);

  constructor() {
    const versus = inject(VersusService);
    const translate = inject(TranslateService);
    const onError = catchAndToastError(inject(ToastService), inject(ErrorMessageService));
    versus
      .createPool({ name: translate.get('studio.untitled_versus'), visibility: 'private' })
      .subscribe({
        next: (pool) =>
          void this.router.navigate(['/versus', pool.id], {
            replaceUrl: true,
            state: { fresh: true },
          }),
        error: (error: unknown) => {
          onError(error);
          void this.router.navigateByUrl('/creations?f=versus', { replaceUrl: true });
        },
      });
  }
}
