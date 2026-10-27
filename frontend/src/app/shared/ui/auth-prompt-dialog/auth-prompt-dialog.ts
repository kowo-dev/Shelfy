import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { AuthPromptService } from '@app/core/services/auth/auth-prompt';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { FederationService } from '@app/core/services/federation/federation';
import { injectRegistrationOpen } from '@app/core/services/legal/legal';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { DialogComponent } from '@shared/ui/dialog/dialog';
import { ButtonComponent } from '@shared/ui/button/button';
import { InputComponent } from '@shared/ui/input/input';

@Component({
  selector: 'shelfy-auth-prompt-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent, InputComponent, ReactiveFormsModule, TranslatePipe],
  template: `
    <shelfy-dialog
      [open]="authPrompt.isOpen()"
      [title]="
        remoteFollowAvailable()
          ? ('auth.remote_follow.title' | translate: { username: authPrompt.remoteFollow() ?? '' })
          : ('auth.login_required_title' | translate)
      "
      (closed)="authPrompt.hide()"
    >
      <p class="text-text-muted">
        {{
          (remoteFollowAvailable() ? 'auth.remote_follow.body' : 'auth.login_required_body')
            | translate
        }}
      </p>

      @if (remoteFollowAvailable()) {
        <div class="border-border mt-5 border-t pt-5">
          <p class="text-text-muted mb-3 text-sm">{{ 'auth.remote_follow.divider' | translate }}</p>
          <form
            class="flex flex-col gap-3 sm:flex-row sm:items-end"
            (submit)="$event.preventDefault(); continueOnOwnServer()"
          >
            <shelfy-input
              class="min-w-0 flex-1"
              [label]="'auth.remote_follow.label' | translate"
              placeholder="@you@mastodon.social"
              autocomplete="off"
              [formControl]="handle"
            />
            <shelfy-button
              type="submit"
              variant="secondary"
              [loading]="remoteBusy()"
              [disabled]="!handle.value.trim()"
            >
              {{ 'auth.remote_follow.continue' | translate }}
            </shelfy-button>
          </form>
          @if (remoteError(); as message) {
            <p role="alert" class="text-danger mt-2 text-sm">{{ message }}</p>
          }
        </div>
      }

      <div dialogFooter class="contents">
        @if (registrationOpen()) {
          <shelfy-button type="button" variant="secondary" (click)="goToRegister()">
            {{ 'auth.create_account' | translate }}
          </shelfy-button>
        }
        <shelfy-button type="button" variant="primary" (click)="goToLogin()">
          {{ 'auth.sign_in' | translate }}
        </shelfy-button>
      </div>
    </shelfy-dialog>
  `,
})
export class AuthPromptDialogComponent {
  readonly authPrompt = inject(AuthPromptService);
  private readonly router = inject(Router);
  private readonly federation = inject(FederationService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly document = inject(DOCUMENT);

  readonly handle = new FormControl('', { nonNullable: true });
  readonly remoteBusy = signal(false);
  readonly remoteError = signal<string | null>(null);

  private readonly federationEnabled = signal(false);
  readonly registrationOpen = injectRegistrationOpen(this.authPrompt.isOpen);

  constructor() {
    effect(() => {
      if (this.authPrompt.isOpen() && this.authPrompt.remoteFollow()) {
        this.federation
          .enabled()
          .pipe(take(1))
          .subscribe((enabled) => this.federationEnabled.set(enabled));
      }
    });
  }

  remoteFollowAvailable(): boolean {
    return this.authPrompt.isOpen() && !!this.authPrompt.remoteFollow() && this.federationEnabled();
  }

  goToLogin(): void {
    const returnUrl = this.authPrompt.returnUrl();
    this.authPrompt.hide();
    void this.router.navigate(['/auth/login'], { queryParams: returnUrl ? { returnUrl } : {} });
  }

  goToRegister(): void {
    const returnUrl = this.authPrompt.returnUrl();
    this.authPrompt.hide();
    void this.router.navigate(['/auth/register'], { queryParams: returnUrl ? { returnUrl } : {} });
  }

  continueOnOwnServer(): void {
    const username = this.authPrompt.remoteFollow();
    const address = this.handle.value.trim();
    if (!username || !address || this.remoteBusy()) return;
    this.remoteBusy.set(true);
    this.remoteError.set(null);
    this.federation.remoteFollowUrl(address, username).subscribe({
      next: ({ url }) => {
        this.remoteBusy.set(false);
        this.redirect(url);
      },
      error: (error: unknown) => {
        this.remoteBusy.set(false);
        this.remoteError.set(this.errorMessage.fromError(error));
      },
    });
  }

  protected redirect(url: string): void {
    this.document.location.assign(url);
  }
}
