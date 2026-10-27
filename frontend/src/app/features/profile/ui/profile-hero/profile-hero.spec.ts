import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { TranslateService } from '@app/core/services/translate/translate';

import { ProfileHeroComponent } from './profile-hero';

describe('ProfileHeroComponent', () => {
  const ambient = {
    follow: vi.fn().mockResolvedValue(undefined),
    colorOf: vi.fn().mockResolvedValue(null),
  };

  function create(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({
      imports: [ProfileHeroComponent],
      providers: [
        provideRouter([]),
        { provide: AmbientService, useValue: ambient },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(ProfileHeroComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the name and meta line', () => {
    const el = create({ name: 'Kowo', meta: ['@kowo'] }).nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Kowo');
    expect(el.textContent).toContain('@kowo');
  });

  it('uses the chosen banner as the background', () => {
    const fixture = create({
      name: 'Kowo',
      bannerUrl: 'https://img/banner.jpg',
      bannerPosition: 30,
    });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://img/banner.jpg');
    expect(el.querySelector('[data-brand-wash]')).toBeNull();
    expect(ambient.follow).toHaveBeenLastCalledWith('https://img/banner.jpg');
  });

  it('falls back to the brand wash without a banner', () => {
    const el = create({ name: 'Kowo' }).nativeElement as HTMLElement;

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-brand-wash]')).not.toBeNull();
  });
});
