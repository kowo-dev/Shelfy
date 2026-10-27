import { of } from 'rxjs';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LegalService } from '@app/core/services/legal/legal';
import { TranslateService } from '@app/core/services/translate/translate';

import { LegalNoticePageComponent } from './legal-notice';

describe('LegalNoticePageComponent', () => {
  it('populates fields from the legal service response', async () => {
    const legalService = {
      getInfo: vi.fn().mockReturnValue(
        of({
          controllerName: 'Shelfy SAS',
          contactEmail: 'contact@shelfy.app',
          hostingProviderName: 'Hetzner',
          hostingProviderAddress: 'Germany',
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [LegalNoticePageComponent],
      providers: [
        provideRouter([]),
        { provide: LegalService, useValue: legalService },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LegalNoticePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.controllerName()).toBe('Shelfy SAS');
    expect(fixture.componentInstance.contactEmail()).toBe('contact@shelfy.app');
    expect(fixture.componentInstance.hostingProviderName()).toBe('Hetzner');
    expect(fixture.componentInstance.hostingProviderAddress()).toBe('Germany');
  });

  it('falls back to em-dashes for missing fields', async () => {
    const legalService = { getInfo: vi.fn().mockReturnValue(of({})) };

    await TestBed.configureTestingModule({
      imports: [LegalNoticePageComponent],
      providers: [
        provideRouter([]),
        { provide: LegalService, useValue: legalService },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LegalNoticePageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.controllerName()).toBe('—');
    expect(fixture.componentInstance.contactEmail()).toBe('—');
  });
});
