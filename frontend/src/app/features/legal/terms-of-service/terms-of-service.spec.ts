import { of } from 'rxjs';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LegalService } from '@app/core/services/legal/legal';
import { TranslateService } from '@app/core/services/translate/translate';

import { TermsOfServicePageComponent } from './terms-of-service';

describe('TermsOfServicePageComponent', () => {
  it('populates the contact email from the legal service response', async () => {
    const legalService = {
      getInfo: vi.fn().mockReturnValue(of({ contactEmail: 'contact@shelfy.app' })),
    };

    await TestBed.configureTestingModule({
      imports: [TermsOfServicePageComponent],
      providers: [
        provideRouter([]),
        { provide: LegalService, useValue: legalService },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TermsOfServicePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.contactEmail()).toBe('contact@shelfy.app');
  });

  it('falls back to an em-dash when no contact email is returned', async () => {
    const legalService = { getInfo: vi.fn().mockReturnValue(of({})) };

    await TestBed.configureTestingModule({
      imports: [TermsOfServicePageComponent],
      providers: [
        provideRouter([]),
        { provide: LegalService, useValue: legalService },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TermsOfServicePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.contactEmail()).toBe('—');
  });
});
