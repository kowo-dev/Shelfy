import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';

import { ProfileFormComponent } from './profile-form';

describe('ProfileFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileFormComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function create(overrides: { usernameError?: string; visibility?: string } = {}) {
    const fb = TestBed.inject(FormBuilder);
    const form = fb.group({
      username: ['kowo'],
      displayName: ['Kowo'],
      bio: ['hello'],
      profileVisibility: ['public'],
    });
    const fixture = TestBed.createComponent(ProfileFormComponent);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('values', {
      displayName: 'Kowo',
      bio: 'hello',
      profileVisibility: overrides.visibility ?? 'public',
    });
    fixture.componentRef.setInput('usernameError', overrides.usernameError ?? '');
    fixture.componentRef.setInput('displayNameError', '');
    fixture.componentRef.setInput('bioError', '');
    fixture.detectChanges();
    return { fixture, form };
  }

  it('emits save on form submit (Enter in a field)', () => {
    const { fixture } = create();
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );

    expect(spy).toHaveBeenCalled();
  });

  it('shows the counters and the field error', () => {
    const { fixture } = create({ usernameError: 'taken' });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('4/50');
    expect(text).toContain('5/300');
    expect(text).toContain('taken');
  });

  it('explains who sees the shelf, mentioning other instances only when federated', () => {
    const { fixture } = create({ visibility: 'private' });
    const hint = () =>
      (
        fixture.nativeElement.querySelector('#settings-visibility-hint') as HTMLElement | null
      )?.textContent?.trim();

    expect(hint()).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('settings.visibility_hint.private');

    fixture.componentRef.setInput('federationEnabled', true);
    fixture.detectChanges();

    expect(hint()).toBe('settings.visibility_hint.private_federated');
  });

  it('marks the current visibility as checked and changes it on click', () => {
    const { fixture, form } = create({ visibility: 'public' });
    const pills = fixture.nativeElement.querySelectorAll(
      'button[role="radio"]',
    ) as NodeListOf<HTMLButtonElement>;

    expect(pills[0].getAttribute('aria-checked')).toBe('true');
    expect(pills[1].getAttribute('aria-checked')).toBe('false');
    expect(pills[0].className).toContain('bg-accent/12');

    pills[1].click();

    expect(form.controls.profileVisibility.value).toBe('private');
    expect(form.controls.profileVisibility.dirty).toBe(true);
  });

  it('enables the save button only when there is something valid to save', () => {
    const { fixture } = create();
    const save = () =>
      fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(save().disabled).toBe(true);

    fixture.componentRef.setInput('canSave', true);
    fixture.detectChanges();
    expect(save().disabled).toBe(false);

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    expect(save().disabled).toBe(true);
    expect(save().getAttribute('aria-busy')).toBe('true');
  });

  it('hides its own save button on desktop when the page provides one', () => {
    const { fixture } = create();
    const wrapper = () =>
      (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement)
        .parentElement as HTMLElement;
    expect(wrapper().classList.contains('md:hidden')).toBe(false);

    fixture.componentRef.setInput('inlineSubmit', false);
    fixture.detectChanges();
    expect(wrapper().classList.contains('md:hidden')).toBe(true);
  });
});
