import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { SteamAuthorizeUrlResponse, SteamImportEntry, SteamImportStatus } from './steam.model';
import { SteamService } from './steam';

const BASE_URL = `${environment.baseUrl}/steam`;

function importStatus(overrides: Partial<SteamImportStatus> = {}): SteamImportStatus {
  return {
    jobId: 'job1',
    status: 'processing',
    gamesTotal: 20,
    gamesImported: 5,
    gamesSkipped: 0,
    errorMessage: null,
    ...overrides,
  };
}

function importEntry(overrides: Partial<SteamImportEntry> = {}): SteamImportEntry {
  return {
    steamAppId: 440,
    steamName: 'Team Fortress 2',
    status: 'imported',
    reason: null,
    reasonDetail: null,
    igdbName: 'Team Fortress 2',
    ...overrides,
  };
}

describe('SteamService', () => {
  let service: SteamService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SteamService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAuthorizeUrl() requests /steam/oauth/authorize', () => {
    let result: SteamAuthorizeUrlResponse | undefined;
    service.getAuthorizeUrl().subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${BASE_URL}/oauth/authorize`);
    expect(req.request.method).toBe('GET');
    const response = { url: 'https://steamcommunity.com/openid/login' };
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('disconnect() deletes /steam/connection', () => {
    let done = false;
    service.disconnect().subscribe(() => (done = true));

    const req = httpMock.expectOne(`${BASE_URL}/connection`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('startImport() posts to /steam/import', () => {
    let result: SteamImportStatus | undefined;
    service.startImport().subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${BASE_URL}/import`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    const response = importStatus();
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('getImportStatus() requests /steam/import/:jobId', () => {
    service.getImportStatus('job1').subscribe();

    httpMock.expectOne(`${BASE_URL}/import/job1`).flush(importStatus());
  });

  it('getLatestImport() requests /steam/import/latest', () => {
    service.getLatestImport().subscribe();

    httpMock.expectOne(`${BASE_URL}/import/latest`).flush(importStatus());
  });

  it('getImportEntries() requests /steam/import/:jobId/entries', () => {
    let result: SteamImportEntry[] | undefined;
    service.getImportEntries('job1').subscribe((r) => (result = r));

    const response = [importEntry()];
    httpMock.expectOne(`${BASE_URL}/import/job1/entries`).flush(response);

    expect(result).toEqual(response);
  });

  it('propagates a 401 when the steam account is not connected', () => {
    let error: unknown;
    service.getAuthorizeUrl().subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne(`${BASE_URL}/oauth/authorize`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect((error as { status: number }).status).toBe(401);
  });
});
