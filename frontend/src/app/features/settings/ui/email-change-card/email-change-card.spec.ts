import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';

import { EmailChangeCardComponent } from './email-change-card';

describe('EmailChangeCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailChangeCardComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function create(pendingEmail: string | null = null, emailVerified = true) {
    const fb = TestBed.inject(FormBuilder);
    const fixture = TestBed.createComponent(EmailChangeCardComponent);
    fixture.componentRef.setInput('email', 'kowo@example.com');
    fixture.componentRef.setInput('pendingEmail', pendingEmail);
    fixture.componentRef.setInput('emailVerified', emailVerified);
    fixture.componentRef.setInput('form', fb.group({ newEmail: [''] }));
    fixture.componentRef.setInput('newEmailError', '');
    fixture.componentRef.setInput('sending', false);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the current email', () => {
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('kowo@example.com');
  });

  it('shows the unverified warning when emailVerified is false', () => {
    const fixture = create(null, false);
    expect(fixture.nativeElement.textContent).toContain('settings.profile.email.not_verified');
  });

  it('does not show the unverified warning when emailVerified is true', () => {
    const fixture = create(null, true);
    expect(fixture.nativeElement.textContent).not.toContain('settings.profile.email.not_verified');
  });

  it('shows the pending email message when set', () => {
    const fixture = create('new@example.com');
    expect(fixture.nativeElement.textContent).toContain('settings.profile.email.pending');
  });

  it('emits requestChange on form submit', () => {
    const fixture = create();
    const spy = vi.fn();
    fixture.componentInstance.requestChange.subscribe(spy);

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    expect(spy).toHaveBeenCalled();
  });
});
