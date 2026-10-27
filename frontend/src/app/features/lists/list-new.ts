import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ListsService } from '@app/core/services/lists/lists';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';

@Component({
  selector: 'shelfy-list-new-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  template: `
    <main class="grid min-h-full place-items-center pt-(--nav-bar-height)" aria-busy="true">
      <shelfy-spinner />
    </main>
  `,
})
export class ListNewPageComponent {
  private readonly router = inject(Router);

  constructor() {
    const lists = inject(ListsService);
    const translate = inject(TranslateService);
    const onError = catchAndToastError(inject(ToastService), inject(ErrorMessageService));
    lists
      .create({
        name: translate.get('studio.untitled_list'),
        visibility: 'private',
        tags: [],
        media: [],
      })
      .subscribe({
        next: (list) =>
          void this.router.navigate(['/lists', list.id], {
            replaceUrl: true,
            state: { fresh: true },
          }),
        error: (error: unknown) => {
          onError(error);
          void this.router.navigateByUrl('/creations?f=lists', { replaceUrl: true });
        },
      });
  }
}
