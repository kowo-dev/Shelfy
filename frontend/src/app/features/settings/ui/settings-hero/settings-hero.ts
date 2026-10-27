import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AvatarComponent } from '@app/shared/ui/avatar/avatar';
import { IconComponent } from '@shared/ui/icon/icon';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';

@Component({
  selector: 'shelfy-settings-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, SpinnerComponent, TranslatePipe],
  templateUrl: './settings-hero.html',
  host: { class: 'block' },
})
export class SettingsHeroComponent {
  readonly displayName = input.required<string>();
  readonly username = input('');
  readonly bannerUrl = input<string | null>(null);
  readonly bannerPosition = input(50);
  readonly avatarUrl = input<string | null>(null);
  readonly avatarBusy = input(false);

  readonly changeBanner = output<void>();
  readonly uploadAvatar = output<File>();
  readonly removeAvatar = output<void>();
  readonly removeBanner = output<void>();

  protected readonly name = computed(() => this.displayName() || this.username());
  protected readonly glass =
    'inline-flex h-11 cursor-pointer items-center gap-2 rounded-[0.875rem] bg-black/55 px-3.5 text-[0.9375rem] font-semibold text-white backdrop-blur-xl transition-colors hover:bg-black/75';

  protected onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.uploadAvatar.emit(file);
  }
}
