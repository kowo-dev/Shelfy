import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';
import type { SteamImportStatus } from '@app/core/services/steam/steam.model';

import { SteamImportCardComponent } from './steam-import-card';

describe('SteamImportCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SteamImportCardComponent],
      providers: [
        {
          provide: TranslateService,
          useValue: { get: (key: string) => key, lang: () => 'en' },
        },
      ],
    }).compileComponents();
  });

  function create(connected = false) {
    const fixture = TestBed.createComponent(SteamImportCardComponent);
    fixture.componentRef.setInput('steamConnected', connected);
    fixture.componentRef.setInput('connecting', false);
    fixture.componentRef.setInput('disconnecting', false);
    fixture.componentRef.setInput('importStarting', false);
    fixture.componentRef.setInput('importActive', false);
    fixture.componentRef.setInput('importStatus', null);
    fixture.componentRef.setInput('importProgress', 0);
    fixture.componentRef.setInput('entriesExpanded', false);
    fixture.componentRef.setInput('entriesLoading', false);
    fixture.componentRef.setInput('entries', null);
    fixture.componentRef.setInput('skippedEntries', []);
    fixture.componentRef.setInput('importedEntries', []);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a connect button when not connected', () => {
    const fixture = create(false);
    expect(fixture.nativeElement.querySelector('img[src*="sits"]')).not.toBeNull();
  });

  it('emits connect when the connect button is clicked', () => {
    const fixture = create(false);
    const spy = vi.fn();
    fixture.componentInstance.connect.subscribe(spy);

    const connectButton = fixture.nativeElement.querySelector(
      'button[aria-label]',
    ) as HTMLButtonElement;
    connectButton.click();

    expect(spy).toHaveBeenCalled();
  });

  it('emits disconnect when connected and the disconnect button is clicked', () => {
    const fixture = create(true);
    const spy = vi.fn();
    fixture.componentInstance.disconnect.subscribe(spy);

    const disconnectButton = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('settings.import.steam.disconnect'))!;
    disconnectButton.click();

    expect(spy).toHaveBeenCalled();
  });

  it('emits startImport when connected', () => {
    const fixture = create(true);
    const spy = vi.fn();
    fixture.componentInstance.startImport.subscribe(spy);

    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('settings.import.steam.import_library'))!
      .click();

    expect(spy).toHaveBeenCalled();
  });

  it('shows completed status text', () => {
    const fixture = create(true);
    fixture.componentRef.setInput('importStatus', {
      jobId: 'job-1',
      status: 'completed',
      gamesImported: 4,
      gamesTotal: 4,
      gamesSkipped: 1,
      errorMessage: null,
    } satisfies SteamImportStatus);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('settings.import.steam.import_completed');
  });
});
