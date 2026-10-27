import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DiscoverService } from '@app/core/services/discover/discover';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';

import { LegalShellComponent } from './legal-shell';

@Component({
  standalone: true,
  imports: [LegalShellComponent],
  template: `<shelfy-legal-shell title="Terms" active="terms"><p>Body</p></shelfy-legal-shell>`,
})
class HostComponent {}

describe('LegalShellComponent', () => {
  function create() {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([]),
        {
          provide: DiscoverService,
          useValue: {
            getMovies: vi.fn(() => of({ content: [{ posterPath: '/m.jpg' }] })),
            getSeries: vi.fn(() => of({ content: [{ posterPath: '/s.jpg' }] })),
          },
        },
        { provide: TmdbService, useValue: { imageUrl: (path: string) => path } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('heads the document with the page hero and projects its text', () => {
    const el = create();
    expect(el.querySelector('shelfy-page-hero h1')?.textContent).toContain('Terms');
    expect(el.querySelector('article')?.textContent).toContain('Body');
    expect(el.querySelectorAll('shelfy-page-hero img').length).toBeGreaterThan(0);
  });

  it('lists the three legal documents in the tab bar and marks the current one', () => {
    const tabs = Array.from(create().querySelectorAll('shelfy-tabs button'));
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'auth.terms_privacy_policy',
      'auth.terms_of_service',
      'legal.notice.title',
    ]);
    expect(tabs[1].getAttribute('aria-current')).toBe('location');
    expect(tabs[0].getAttribute('aria-current')).toBeNull();
  });

  it('opens another document from the tabs', () => {
    create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const shell = TestBed.createComponent(LegalShellComponent);
    shell.componentRef.setInput('title', 'Terms');
    shell.componentRef.setInput('active', 'terms');

    shell.componentInstance.open('notice');
    shell.componentInstance.open('bogus');

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/legal/notice');
  });
});
