import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { Observable } from 'rxjs';
import { ApiError } from '@app/core/errors/api-error';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { FederationService, type MigrationStatus } from '@app/core/services/federation/federation';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';
import { InputComponent } from '@shared/ui/input/input';
import { collapse } from '@shared/ui/ui-recipes';

type Busy = 'alias' | 'move';

@Component({
  selector: 'shelfy-account-migration-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputComponent, ReactiveFormsModule, TranslatePipe],
  templateUrl: './account-migration-card.html',
  host: { class: 'block' },
})
export class AccountMigrationCardComponent {
  private readonly federation = inject(FederationService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);

  readonly pill = buttonClasses({ variant: 'secondary', extraClass: 'w-fit shrink-0' });
  readonly destructive = buttonClasses({ variant: 'secondary' });
  readonly collapse = collapse;

  readonly open = signal(false);
  readonly status = signal<MigrationStatus | null>(null);
  readonly busy = signal<Busy | null>(null);
  readonly error = signal<string | null>(null);
  readonly aliasHandle = new FormControl('', { nonNullable: true });
  readonly moveHandle = new FormControl('', { nonNullable: true });

  toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next && !this.status()) {
      this.federation.migration().subscribe({
        next: (status) => this.status.set(status),
        error: (error: unknown) => this.error.set(this.messageOf(error)),
      });
    }
  }

  saveAlias(): void {
    const handle = this.aliasHandle.value.trim();
    if (!handle) return;
    this.run('alias', this.federation.setAlias(handle), 'settings.migration.alias_saved', () =>
      this.aliasHandle.reset(),
    );
  }

  removeAlias(): void {
    this.run('alias', this.federation.clearAlias(), 'settings.migration.alias_removed');
  }

  async move(): Promise<void> {
    const handle = this.moveHandle.value.trim();
    if (!handle) return;
    const confirmed = await this.confirm.ask(
      this.translate.get('settings.migration.confirm_message', { handle }),
      {
        title: this.translate.get('settings.migration.confirm_title'),
        confirmLabel: this.translate.get('settings.migration.move'),
        cancelLabel: this.translate.get('settings.cancel'),
        destructive: true,
      },
    );
    if (!confirmed) return;
    this.run('move', this.federation.moveTo(handle), 'settings.migration.moved', () =>
      this.moveHandle.reset(),
    );
  }

  private run(
    busy: Busy,
    action: Observable<MigrationStatus>,
    successKey: string,
    done?: () => void,
  ): void {
    this.busy.set(busy);
    this.error.set(null);
    action.subscribe({
      next: (status) => {
        this.busy.set(null);
        this.status.set(status);
        this.toast.success(this.translate.get(successKey));
        done?.();
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.error.set(this.messageOf(error));
      },
    });
  }

  private messageOf(error: unknown): string {
    return error instanceof ApiError && error.code === 'FEDERATION_UNAVAILABLE'
      ? error.message
      : this.errorMessage.fromError(error);
  }
}
