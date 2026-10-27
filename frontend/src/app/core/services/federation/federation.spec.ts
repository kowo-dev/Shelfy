import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { FederationService } from './federation';

describe('FederationService', () => {
  let service: FederationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FederationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks the API where to send a visitor from another server', () => {
    let url = '';
    service.remoteFollowUrl('@me@example.social', 'kowo').subscribe((result) => (url = result.url));

    const request = http.expectOne(
      (req) => req.url === `${environment.baseUrl}/federation/remote-follow`,
    );
    expect(request.request.params.get('handle')).toBe('@me@example.social');
    expect(request.request.params.get('username')).toBe('kowo');
    request.flush({ url: 'https://example.social/authorize_interaction?uri=x' });

    expect(url).toBe('https://example.social/authorize_interaction?uri=x');
  });

  it('reads the federation flag once and shares it', () => {
    const seen: boolean[] = [];
    service.enabled().subscribe((value) => seen.push(value));
    service.enabled().subscribe((value) => seen.push(value));

    http.expectOne(`${environment.baseUrl}/legal/info`).flush({ isFederationEnabled: true });

    expect(seen).toEqual([true, true]);
  });

  it('treats a failing legal request as federation off', () => {
    let enabled: boolean | undefined;
    service.enabled().subscribe((value) => (enabled = value));

    http.expectOne(`${environment.baseUrl}/legal/info`).error(new ProgressEvent('error'));

    expect(enabled).toBe(false);
  });
});
