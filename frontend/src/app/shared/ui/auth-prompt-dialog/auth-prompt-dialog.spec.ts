import { vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { AuthPromptService } from '@app/core/services/auth/auth-prompt';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { FederationService } from '@app/core/services/federation/federation';

import { AuthPromptDialogComponent } from './auth-prompt-dialog';

describe('AuthPromptDialogComponent', () => {
  let isOpen: ReturnType<typeof signal<boolean>>;
  let returnUrl: ReturnType<typeof signal<string | null>>;
  let remoteFollow: ReturnType<typeof signal<string | null>>;
  let hide: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let federation: {
    enabled: ReturnType<typeof vi.fn>;
    remoteFollowUrl: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    isOpen = signal(false);
    returnUrl = signal(null);
    remoteFollow = signal<string | null>(null);
    federation = {
      enabled: vi.fn().mockReturnValue(of(true)),
      remoteFollowUrl: vi.fn().mockReturnValue(of({ url: 'https://example.social/follow?uri=x' })),
    };
    hide = vi.fn(() => isOpen.set(false));
    navigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [AuthPromptDialogComponent],
      providers: [
        { provide: AuthPromptService, useValue: { isOpen, returnUrl, remoteFollow, hide } },
        { provide: FederationService, useValue: federation },
        {
          provide: ErrorMessageService,
          useValue: { fromError: () => 'Could not reach example.social' },
        },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(AuthPromptDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('does not render the dialog content when closed', () => {
    const fixture = createComponent();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the dialog when the auth prompt is open', () => {
    isOpen.set(true);
    const fixture = createComponent();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('goToLogin() hides the prompt and navigates to /auth/login', () => {
    const fixture = createComponent();
    fixture.componentInstance.goToLogin();

    expect(hide).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: {} });
  });

  it('goToRegister() hides the prompt and navigates to /auth/register', () => {
    const fixture = createComponent();
    fixture.componentInstance.goToRegister();

    expect(hide).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/register'], { queryParams: {} });
  });

  it('offers to follow from another server when asked and federation is on', () => {
    isOpen.set(true);
    remoteFollow.set('kowo');
    const fixture = createComponent();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input')).not.toBeNull();
  });

  it('keeps the plain prompt for other actions', () => {
    isOpen.set(true);
    const fixture = createComponent();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(federation.enabled).not.toHaveBeenCalled();
  });

  it('keeps the plain prompt when federation is off', () => {
    federation.enabled.mockReturnValue(of(false));
    isOpen.set(true);
    remoteFollow.set('kowo');
    const fixture = createComponent();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input')).toBeNull();
  });

  it('sends the visitor to their own server', () => {
    isOpen.set(true);
    remoteFollow.set('kowo');
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const redirect = vi.spyOn(
      component as unknown as { redirect: (url: string) => void },
      'redirect',
    );
    redirect.mockImplementation(() => undefined);
    component.handle.setValue(' @me@example.social ');

    component.continueOnOwnServer();

    expect(federation.remoteFollowUrl).toHaveBeenCalledWith('@me@example.social', 'kowo');
    expect(redirect).toHaveBeenCalledWith('https://example.social/follow?uri=x');
  });

  it('shows why the address was refused', () => {
    federation.remoteFollowUrl.mockReturnValue(throwError(() => new Error('nope')));
    isOpen.set(true);
    remoteFollow.set('kowo');
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.handle.setValue('@me@example.social');

    component.continueOnOwnServer();

    expect(component.remoteError()).toBe('Could not reach example.social');
    expect(component.remoteBusy()).toBe(false);
  });
});
