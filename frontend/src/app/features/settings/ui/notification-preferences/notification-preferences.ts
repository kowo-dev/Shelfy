import { TranslateService } from '@app/core/services/translate/translate';
import { SegmentedComponent } from '@shared/ui/segmented/segmented';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { NotificationsService } from '@app/core/services/notifications/notifications';
import type {
  NotificationAudience,
  NotificationFamily,
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from '@app/core/services/notifications/notifications.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslatePipe } from '@shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { FAMILY_ICONS } from '@shared/ui/notification-row/notification-copy';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { ToggleComponent } from '@shared/ui/toggle/toggle';
import { GROUP_HEADING, SETTINGS_ROWS } from '@shared/ui/ui-recipes';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';

const AUDIENCES: readonly NotificationAudience[] = ['EVERYONE', 'CONNECTIONS'];

@Component({
  selector: 'shelfy-notification-preferences',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SegmentedComponent, TranslatePipe, IconComponent, SpinnerComponent, ToggleComponent],
  templateUrl: './notification-preferences.html',
  host: { class: 'flex min-w-0 flex-col gap-10' },
})
export class NotificationPreferencesComponent {
  private readonly api = inject(NotificationsService);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);

  protected readonly preferences = signal<NotificationPreferences | null>(null);
  protected readonly failed = signal(false);
  protected readonly expanded = signal<NotificationFamily | null>(null);
  protected readonly audiences = AUDIENCES;
  private readonly translate = inject(TranslateService);
  protected readonly audienceOptions = computed(() => {
    this.translate.lang();
    return AUDIENCES.map((id) => ({
      id,
      label: this.translate.get('settings.notifications.audience.' + id),
    }));
  });
  protected readonly icons = FAMILY_ICONS;
  protected readonly heading = GROUP_HEADING;
  protected readonly rows = SETTINGS_ROWS;

  constructor() {
    this.api.preferences().subscribe({
      next: (preferences) => this.preferences.set(preferences),
      error: () => this.failed.set(true),
    });
  }

  protected toggleExpanded(family: NotificationFamily): void {
    this.expanded.update((current) => (current === family ? null : family));
  }

  protected setFamily(family: NotificationFamily, enabled: boolean): void {
    this.save({ families: { [family]: enabled } }, (preferences) => ({
      ...preferences,
      families: preferences.families.map((item) =>
        item.family === family ? { ...item, isEnabled: enabled } : item,
      ),
    }));
  }

  protected setSetting(setting: string, enabled: boolean): void {
    this.save({ settings: { [setting]: enabled } }, (preferences) => ({
      ...preferences,
      families: preferences.families.map((family) => ({
        ...family,
        settings: family.settings.map((item) =>
          item.setting === setting ? { ...item, isEnabled: enabled } : item,
        ),
      })),
    }));
  }

  protected setAudience(audience: NotificationAudience): void {
    if (this.preferences()?.audience === audience) return;
    this.save({ audience }, (preferences) => ({ ...preferences, audience }));
  }

  private save(
    update: NotificationPreferencesUpdate,
    optimistic: (preferences: NotificationPreferences) => NotificationPreferences,
  ): void {
    const before = this.preferences();
    if (!before) return;
    this.preferences.set(optimistic(before));
    this.api.updatePreferences(update).subscribe({
      next: (preferences) => this.preferences.set(preferences),
      error: (error: unknown) => {
        this.preferences.set(before);
        catchAndToastError(this.toast, this.errorMessage)(error);
      },
    });
  }
}
