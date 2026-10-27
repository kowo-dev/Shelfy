import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { TranslateService } from '@app/core/services/translate/translate';

import { SettingsHeroComponent } from './settings-hero';

describe('SettingsHeroComponent', () => {
  function create(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [SettingsHeroComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(SettingsHeroComponent);
    fixture.componentRef.setInput('displayName', 'Kowo');
    fixture.componentRef.setInput('username', 'kowo');
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ReturnType<typeof create>) => fixture.nativeElement as HTMLElement;

  const buttonWith = (fixture: ReturnType<typeof create>, key: string) =>
    Array.from(el(fixture).querySelectorAll('button')).find((button) =>
      button.textContent?.includes(key),
    ) as HTMLButtonElement | undefined;

  const labelled = (fixture: ReturnType<typeof create>, key: string) =>
    el(fixture).querySelector(`button[aria-label="${key}"]`) as HTMLButtonElement | null;

  it('shows the avatar over the banner with its hint', () => {
    const fixture = create();
    expect(el(fixture).textContent).toContain('settings.avatar_banner.avatar.hint');
    expect(el(fixture).querySelector('shelfy-avatar')?.textContent).toContain('K');
  });

  it('shows the banner at its saved position, or the fallback when there is none', () => {
    const withBanner = create({ bannerUrl: 'https://img/banner.jpg', bannerPosition: 30 });
    const image = el(withBanner).querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://img/banner.jpg');
    expect(image.style.objectPosition).toBe('center 30%');
    TestBed.resetTestingModule();
    const without = create();
    expect(el(without).querySelector('img')).toBeNull();
    expect(el(without).querySelector('.bg-profile-fallback')).not.toBeNull();
  });

  it('asks to add or change the banner depending on whether one exists', () => {
    const fixture = create();
    const spy = vi.fn();
    fixture.componentInstance.changeBanner.subscribe(spy);
    const button = labelled(fixture, 'settings.avatar_banner.banner.add') as HTMLButtonElement;
    expect(button.textContent).toContain('settings.avatar_banner.banner.add');
    expect(labelled(fixture, 'settings.avatar_banner.banner.remove')).toBeNull();

    button.click();
    expect(spy).toHaveBeenCalled();

    fixture.componentRef.setInput('bannerUrl', 'https://img/banner.jpg');
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('settings.avatar_banner.banner.change');
    expect(buttonWith(fixture, 'settings.avatar_banner.banner.change')).toBeDefined();
  });

  it('offers to remove the banner only when there is one', () => {
    const fixture = create({ bannerUrl: 'https://img/banner.jpg' });
    const spy = vi.fn();
    fixture.componentInstance.removeBanner.subscribe(spy);

    labelled(fixture, 'settings.avatar_banner.banner.remove')?.click();

    expect(spy).toHaveBeenCalled();
  });

  it('emits the picked avatar file', () => {
    const fixture = create();
    const spy = vi.fn();
    fixture.componentInstance.uploadAvatar.subscribe(spy);
    const input = el(fixture).querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['a'], 'a.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file] });

    input.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledWith(file);
  });

  it('offers to remove the avatar only when there is one', () => {
    const without = create();
    expect(el(without).textContent).not.toContain('settings.avatar_banner.avatar.remove');
    TestBed.resetTestingModule();

    const fixture = create({ avatarUrl: 'https://img/me.png' });
    const spy = vi.fn();
    fixture.componentInstance.removeAvatar.subscribe(spy);
    buttonWith(fixture, 'settings.avatar_banner.avatar.remove')?.click();

    expect(spy).toHaveBeenCalled();
  });

  it('disables the avatar button while an upload is running', () => {
    const fixture = create({ avatarBusy: true });
    const avatar = el(fixture).querySelector('button[aria-busy="true"]') as HTMLButtonElement;
    expect(avatar.disabled).toBe(true);
  });
});
