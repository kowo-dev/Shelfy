import { of } from 'rxjs';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LegalService } from '@app/core/services/legal/legal';
import { TranslateService } from '@app/core/services/translate/translate';

import { PrivacyPolicyPageComponent } from './privacy-policy';

describe('PrivacyPolicyPageComponent', () => {
  it('populates fields from the legal service response', async () => {
    const legalService = {
      getInfo: vi.fn().mockReturnValue(
        of({
          controllerName: 'Shelfy SAS',
          contactEmail: 'contact@shelfy.app',
          jurisdiction: 'France',
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [PrivacyPolicyPageComponent],
      providers: [
        provideRouter([]),
        { provide: LegalService, useValue: legalService },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PrivacyPolicyPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.controllerName()).toBe('Shelfy SAS');
    expect(fixture.componentInstance.contactEmail()).toBe('contact@shelfy.app');
    expect(fixture.componentInstance.jurisdiction()).toBe('France');
  });

  it('explains federation only when the instance is federated', async () => {
    for (const federationEnabled of [true, false]) {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [PrivacyPolicyPageComponent],
        providers: [
          provideRouter([]),
          {
            provide: LegalService,
            useValue: {
              getInfo: vi.fn().mockReturnValue(of({ isFederationEnabled: federationEnabled })),
            },
          },
          { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(PrivacyPolicyPageComponent);
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent as string;

      expect(text.includes('legal.privacy.federation_deletion')).toBe(federationEnabled);
    }
  });

  it('falls back to em-dashes for missing fields', async () => {
    const legalService = { getInfo: vi.fn().mockReturnValue(of({})) };

    await TestBed.configureTestingModule({
      imports: [PrivacyPolicyPageComponent],
      providers: [
        provideRouter([]),
        { provide: LegalService, useValue: legalService },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PrivacyPolicyPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.jurisdiction()).toBe('—');
  });
});
