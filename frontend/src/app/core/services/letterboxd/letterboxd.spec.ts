import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { LetterboxdImportEntry, LetterboxdImportStatus } from './letterboxd.model';
import { LetterboxdService } from './letterboxd';

const BASE_URL = `${environment.baseUrl}/letterboxd`;

function importStatus(overrides: Partial<LetterboxdImportStatus> = {}): LetterboxdImportStatus {
  return {
    jobId: 'job1',
    status: 'processing',
    entriesTotal: 10,
    entriesImported: 4,
    entriesSkipped: 1,
    errorMessage: null,
    ...overrides,
  };
}

function importEntry(overrides: Partial<LetterboxdImportEntry> = {}): LetterboxdImportEntry {
  return {
    letterboxdTitle: 'Inception',
    letterboxdYear: 2010,
    status: 'imported',
    reason: null,
    reasonDetail: null,
    ...overrides,
  };
}

describe('LetterboxdService', () => {
  let service: LetterboxdService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LetterboxdService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('startImport() posts multipart form data with the file', () => {
    const file = new File(['a,b,c'], 'diary.csv', { type: 'text/csv' });
    let result: LetterboxdImportStatus | undefined;
    service.startImport(file).subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${BASE_URL}/import`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('file')).toBe(file);

    const response = importStatus();
    req.flush(response);
    expect(result).toEqual(response);
  });

  it('getImportStatus() requests /letterboxd/import/:jobId', () => {
    service.getImportStatus('job1').subscribe();

    httpMock.expectOne(`${BASE_URL}/import/job1`).flush(importStatus());
  });

  it('getLatestImport() requests /letterboxd/import/latest', () => {
    service.getLatestImport().subscribe();

    httpMock.expectOne(`${BASE_URL}/import/latest`).flush(importStatus());
  });

  it('getImportEntries() requests /letterboxd/import/:jobId/entries', () => {
    let result: LetterboxdImportEntry[] | undefined;
    service.getImportEntries('job1').subscribe((r) => (result = r));

    const response = [importEntry()];
    httpMock.expectOne(`${BASE_URL}/import/job1/entries`).flush(response);

    expect(result).toEqual(response);
  });

  it('propagates a 404 when the import job is not found', () => {
    let error: unknown;
    service.getImportStatus('missing').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne(`${BASE_URL}/import/missing`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect((error as { status: number }).status).toBe(404);
  });
});
