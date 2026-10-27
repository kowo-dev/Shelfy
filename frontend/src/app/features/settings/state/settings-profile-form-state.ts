import { computed, signal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { catchError, map, of, switchMap, timer } from 'rxjs';
import { AuthService } from '@app/core/services/auth/auth';
import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';
import { TranslateService } from '@app/core/services/translate/translate';

function buildForm(
  fb: FormBuilder,
  currentUser: ReturnType<AuthService['currentUser']>,
  usernameAvailabilityValidator: AsyncValidatorFn,
) {
  return fb.nonNullable.group({
    username: fb.nonNullable.control(currentUser?.username ?? '', {
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern(/^[a-zA-Z0-9_]+$/),
      ],
      asyncValidators: [usernameAvailabilityValidator],
    }),
    displayName: fb.control<string>(currentUser?.displayName ?? '', [Validators.maxLength(50)]),
    bio: fb.control<string>(currentUser?.bio ?? '', [Validators.maxLength(300)]),
    profileVisibility: fb.nonNullable.control<CollectionVisibility>(
      currentUser?.profileVisibility ?? 'public',
    ),
  });
}

export type SettingsProfileForm = ReturnType<typeof buildForm>;

export interface SettingsProfileFormState {
  form: SettingsProfileForm;
  saving: Signal<boolean>;
  usernameError: Signal<string>;
  displayNameError: Signal<string>;
  bioError: Signal<string>;
  allowAdultContent: Signal<boolean>;
  federationOptOut: Signal<boolean>;
  setFederationOptOut: (optOut: boolean) => Promise<void>;
  adultContentConfirmDialogOpen: Signal<boolean>;
  hasChanges: Signal<boolean>;
  toggleAdultContent: (checked: boolean) => Promise<void>;
  confirmAdultContent: () => Promise<void>;
  closeAdultContentConfirmDialog: () => void;
  reset: () => void;
  save: () => Promise<void>;
}

export interface SettingsProfileFormDependencies {
  fb: FormBuilder;
  authService: AuthService;
  translate: TranslateService;
  toastService: ToastService;
  errorMessage: ErrorMessageService;
}

type User = ReturnType<AuthService['currentUser']>;

function usernameAvailabilityValidator(authService: AuthService, user: User): AsyncValidatorFn {
  return (control: AbstractControl): ReturnType<AsyncValidatorFn> => {
    const value = control.value as string;
    if (!value || value === user?.username) return of(null);
    return timer(400).pipe(
      switchMap(() => authService.checkUsernameAvailability(value)),
      map((response): ValidationErrors | null =>
        response.isAvailable ? null : { usernameTaken: true },
      ),
      catchError(() => of(null)),
    );
  };
}

function createAdultContent(initial: boolean) {
  const allow = signal(initial);
  const dialogOpen = signal(false);
  return {
    allow,
    dialogOpen,
    close: () => dialogOpen.set(false),
  };
}

function createProfileErrors(
  form: SettingsProfileForm,
  formEvents: Signal<unknown>,
  translate: TranslateService,
) {
  const fieldError = (
    name: keyof SettingsProfileForm['controls'],
    pick: (c: AbstractControl) => string,
  ) =>
    computed(() => {
      formEvents();
      const control = form.controls[name];
      return control.touched ? pick(control) : '';
    });
  return {
    usernameError: fieldError('username', (c) => {
      if (c.hasError('required')) return translate.get('auth.errors.field_required');
      if (c.hasError('minlength') || c.hasError('maxlength') || c.hasError('pattern'))
        return translate.get('auth.errors.username_format');
      return c.hasError('usernameTaken') ? translate.get('auth.errors.username_taken') : '';
    }),
    displayNameError: fieldError('displayName', (c) =>
      c.hasError('maxlength') ? translate.get('settings.errors.display_name_too_long') : '',
    ),
    bioError: fieldError('bio', (c) =>
      c.hasError('maxlength') ? translate.get('settings.errors.bio_too_long') : '',
    ),
  };
}

export function createSettingsProfileFormState(
  dependencies: SettingsProfileFormDependencies,
): SettingsProfileFormState {
  const { fb, authService, translate, toastService, errorMessage } = dependencies;
  const currentUser = authService.currentUser();
  const saving = signal(false);
  const adult = createAdultContent(currentUser?.isAdultContentAllowed ?? false);
  const optOut = signal(currentUser?.hasOptedOutOfFederation ?? false);
  const form = buildForm(fb, currentUser, usernameAvailabilityValidator(authService, currentUser));
  const formEvents = toSignal(form.events);
  const snapshot = () => JSON.stringify([form.getRawValue(), adult.allow(), optOut()]);
  const baseline = signal(snapshot());

  function reset(): void {
    const user = authService.currentUser();
    form.reset({
      username: user?.username ?? '',
      displayName: user?.displayName ?? '',
      bio: user?.bio ?? '',
      profileVisibility: user?.profileVisibility ?? 'public',
    });
    adult.allow.set(user?.isAdultContentAllowed ?? false);
    optOut.set(user?.hasOptedOutOfFederation ?? false);
    baseline.set(snapshot());
  }

  async function savePreferences(change: () => void): Promise<void> {
    const user = authService.currentUser();
    if (!user) return;
    const previous = [adult.allow(), optOut()] as const;
    change();
    await authService
      .updateProfile({
        username: user.username,
        displayName: user.displayName ?? null,
        bio: user.bio ?? null,
        profileVisibility: user.profileVisibility,
        isAdultContentAllowed: adult.allow(),
        confirmAdultContent: adult.allow(),
        hasOptedOutOfFederation: optOut(),
      })
      .then(() => {
        const [formPart] = JSON.parse(baseline()) as unknown[];
        baseline.set(JSON.stringify([formPart, adult.allow(), optOut()]));
      })
      .catch((error: unknown) => {
        adult.allow.set(previous[0]);
        optOut.set(previous[1]);
        catchAndToastError(toastService, errorMessage)(error);
      });
  }

  async function save(): Promise<void> {
    if (form.invalid || form.pending) {
      form.markAllAsTouched();
      return;
    }
    saving.set(true);
    const { username, displayName, bio, profileVisibility } = form.getRawValue();
    await authService
      .updateProfile({
        username,
        displayName: displayName?.trim() || null,
        bio: bio?.trim() || null,
        profileVisibility,
        isAdultContentAllowed: adult.allow(),
        confirmAdultContent: adult.allow(),
        hasOptedOutOfFederation: optOut(),
      })
      .then(() => {
        saving.set(false);
        baseline.set(snapshot());
      })
      .catch((error: unknown) => {
        saving.set(false);
        catchAndToastError(toastService, errorMessage)(error);
      });
  }

  return {
    form,
    saving: saving.asReadonly(),
    ...createProfileErrors(form, formEvents, translate),
    allowAdultContent: adult.allow.asReadonly(),
    federationOptOut: optOut.asReadonly(),
    setFederationOptOut: (value: boolean) => savePreferences(() => optOut.set(value)),
    adultContentConfirmDialogOpen: adult.dialogOpen.asReadonly(),
    hasChanges: computed(() => {
      formEvents();
      return snapshot() !== baseline();
    }),
    toggleAdultContent: async (checked: boolean) => {
      if (checked) adult.dialogOpen.set(true);
      else await savePreferences(() => adult.allow.set(false));
    },
    confirmAdultContent: () =>
      savePreferences(() => {
        adult.allow.set(true);
        adult.dialogOpen.set(false);
      }),
    closeAdultContentConfirmDialog: adult.close,
    reset,
    save,
  };
}
