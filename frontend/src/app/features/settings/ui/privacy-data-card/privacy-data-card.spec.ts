import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';

import { PrivacyDataCardComponent } from './privacy-data-card';

describe('PrivacyDataCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyDataCardComponent],
      providers: [
        provideRouter([]),
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  it('defaults exporting to false', () => {
    const fixture = TestBed.createComponent(PrivacyDataCardComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.exporting()).toBe(false);
  });

  it('emits exportData when the export button is clicked', () => {
    const fixture = TestBed.createComponent(PrivacyDataCardComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.exportData.subscribe(spy);

    const exportButton = fixture.nativeElement.querySelector('button');
    (exportButton as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalled();
  });

  it('links to the privacy policy and legal notice pages', () => {
    const fixture = TestBed.createComponent(PrivacyDataCardComponent);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll('a');
    const hrefs = Array.from(links).map((a) => (a as HTMLAnchorElement).getAttribute('href'));

    expect(hrefs).toContain('/legal/privacy-policy');
    expect(hrefs).toContain('/legal/notice');
  });
});
