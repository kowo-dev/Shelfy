import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';
import type {
  LetterboxdImportEntry,
  LetterboxdImportStatus,
} from '@app/core/services/letterboxd/letterboxd.model';

import { LetterboxdImportCardComponent } from './letterboxd-import-card';

describe('LetterboxdImportCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LetterboxdImportCardComponent],
      providers: [
        {
          provide: TranslateService,
          useValue: { get: (key: string) => key, lang: () => 'en' },
        },
      ],
    }).compileComponents();
  });

  function status(overrides: Partial<LetterboxdImportStatus>): LetterboxdImportStatus {
    return {
      jobId: 'job-1',
      status: 'processing',
      entriesTotal: 0,
      entriesImported: 0,
      entriesSkipped: 0,
      errorMessage: null,
      ...overrides,
    };
  }

  function create() {
    const fixture = TestBed.createComponent(LetterboxdImportCardComponent);
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

  it('emits fileSelected with the chosen file', () => {
    const fixture = create();
    const spy = vi.fn();
    fixture.componentInstance.fileSelected.subscribe(spy);

    const file = new File(['data'], 'export.zip', { type: 'application/zip' });
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledWith(file);
  });

  it('does not emit fileSelected without a file', () => {
    const fixture = create();
    const spy = vi.fn();
    fixture.componentInstance.fileSelected.subscribe(spy);

    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [] });
    input.dispatchEvent(new Event('change'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('shows progress while the import is active', () => {
    const fixture = create();
    fixture.componentRef.setInput(
      'importStatus',
      status({ status: 'processing', entriesImported: 3, entriesTotal: 10 }),
    );
    fixture.componentRef.setInput('importActive', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('settings.import.letterboxd.importing');
  });

  it('shows a failure message when the import failed', () => {
    const fixture = create();
    fixture.componentRef.setInput('importStatus', status({ status: 'failed' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('settings.import.letterboxd.import_failed');
  });

  it('emits toggleEntries when the details toggle is clicked', () => {
    const fixture = create();
    fixture.componentRef.setInput(
      'importStatus',
      status({ status: 'completed', entriesImported: 5, entriesTotal: 5 }),
    );
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.toggleEntries.subscribe(spy);

    const toggle = Array.from(fixture.nativeElement.querySelectorAll('button')).find((btn) =>
      (btn as HTMLButtonElement).textContent?.includes('view_details'),
    ) as HTMLButtonElement;
    toggle.click();

    expect(spy).toHaveBeenCalled();
  });

  it('lists skipped and imported entries when expanded', () => {
    const fixture = create();
    fixture.componentRef.setInput(
      'importStatus',
      status({ status: 'completed', entriesImported: 1, entriesTotal: 2, entriesSkipped: 1 }),
    );
    fixture.componentRef.setInput('entriesExpanded', true);
    fixture.componentRef.setInput('entries', [] as LetterboxdImportEntry[]);
    fixture.componentRef.setInput('skippedEntries', [
      { letterboxdTitle: 'Movie A', letterboxdYear: 2020, reason: 'duplicate' },
    ] as unknown as LetterboxdImportEntry[]);
    fixture.componentRef.setInput('importedEntries', [
      { letterboxdTitle: 'Movie B', letterboxdYear: 2021 },
    ] as unknown as LetterboxdImportEntry[]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Movie A');
    expect(fixture.nativeElement.textContent).toContain('Movie B');
  });
});
