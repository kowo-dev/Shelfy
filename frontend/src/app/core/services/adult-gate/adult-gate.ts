import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthPromptService } from '@app/core/services/auth/auth-prompt';
import { AuthService } from '@app/core/services/auth/auth';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { TranslateService } from '@app/core/services/translate/translate';

@Injectable({ providedIn: 'root' })
export class AdultGateService {
  private readonly auth = inject(AuthService);
  private readonly authPrompt = inject(AuthPromptService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  async open(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.authPrompt.show(this.router.url);
      return;
    }
    const goToSettings = await this.confirm.ask(this.translate.get('adult.gate_body'), {
      title: this.translate.get('adult.gate_title'),
      confirmLabel: this.translate.get('adult.gate_cta'),
    });
    if (goToSettings) await this.router.navigate(['/settings']);
  }
}
