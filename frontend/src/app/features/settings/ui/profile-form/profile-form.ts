import { InputComponent } from '@shared/ui/input/input';
import { TextareaComponent } from '@shared/ui/textarea/textarea';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import type { SettingsProfileForm } from '../../state/settings-profile-form-state';
import { buttonClasses } from '@shared/ui/button/button';
import { SpinnerComponent } from '@app/shared/ui/spinner/spinner';
import { GROUP_HEADING } from '@shared/ui/ui-recipes';
import { IconComponent } from '@shared/ui/icon/icon';
import type { IconName } from '@shared/ui/icon/icon-registry';

const VISIBILITIES: readonly { value: CollectionVisibility; labelKey: string; icon: IconName }[] = [
  { value: 'public', labelKey: 'settings.visibility.public', icon: 'globe' },
  { value: 'private', labelKey: 'settings.visibility.private', icon: 'lock' },
];

@Component({
  selector: 'shelfy-profile-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    InputComponent,
    TextareaComponent,
    ReactiveFormsModule,
    TranslatePipe,
    SpinnerComponent,
    IconComponent,
  ],
  templateUrl: './profile-form.html',
})
export class ProfileFormComponent {
  readonly visibilities = VISIBILITIES;

  form = input.required<SettingsProfileForm>();
  values = input.required<{
    displayName: string | null;
    bio: string | null;
    profileVisibility: CollectionVisibility;
  }>();
  usernameError = input.required<string>();
  displayNameError = input.required<string>();
  bioError = input.required<string>();

  federationEnabled = input(false);
  canSave = input(false);
  saving = input(false);
  inlineSubmit = input(true);

  save = output<void>();

  readonly primary = buttonClasses({ variant: 'primary' });
  readonly heading = GROUP_HEADING;
  readonly submitClass = computed(() => (this.inlineSubmit() ? '' : 'md:hidden'));

  optionClass(on: boolean): string {
    return (
      'flex cursor-pointer items-start gap-3.5 rounded-[1.25rem] p-4.5 text-left transition-colors duration-300 ' +
      (on ? 'bg-accent/12' : 'bg-white/5 hover:bg-white/8')
    );
  }

  setVisibility(value: CollectionVisibility): void {
    const control = this.form().controls.profileVisibility;
    control.setValue(value);
    control.markAsDirty();
  }
}
