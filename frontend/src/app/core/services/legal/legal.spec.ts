import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { LegalInfo } from './legal.model';
import { LegalService } from './legal';

const INFO_URL = `${environment.baseUrl}/legal/info`;

function legalInfo(overrides: Partial<LegalInfo> = {}): LegalInfo {
  return {
    controllerName: 'Shelfy',
    contactEmail: 'legal@shelfy.app',
    jurisdiction: 'FR',
    hostingProviderName: 'OVH',
    hostingProviderAddress: '2 rue Kellermann',
    isFederationEnabled: false,
    isRegistrationOpen: true,
    ...overrides,
  };
}

describe('LegalService', () => {
  let service: LegalService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LegalService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getInfo() requests /legal/info and maps the response', () => {
    let result: LegalInfo | undefined;
    service.getInfo().subscribe((r) => (result = r));

    const req = httpMock.expectOne(INFO_URL);
    expect(req.request.method).toBe('GET');
    const response = legalInfo();
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('getInfo() asks the server only once', () => {
    service.getInfo().subscribe();
    service.getInfo().subscribe();

    httpMock.expectOne(INFO_URL).flush(legalInfo());
  });

  it('registrationOpen$ follows the instance setting', () => {
    let open: boolean | undefined;
    service.registrationOpen$.subscribe((value) => (open = value));

    httpMock.expectOne(INFO_URL).flush(legalInfo({ isRegistrationOpen: false }));

    expect(open).toBe(false);
  });

  it('registrationOpen$ stays open when the server cannot answer', () => {
    let open: boolean | undefined;
    service.registrationOpen$.subscribe((value) => (open = value));

    httpMock.expectOne(INFO_URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(open).toBe(true);
  });

  it('propagates a server error', () => {
    let error: unknown;
    service.getInfo().subscribe({ error: (err) => (error = err) });

    httpMock.expectOne(INFO_URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect((error as { status: number }).status).toBe(500);
  });
});
