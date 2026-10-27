import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Observable } from 'rxjs';
import { vi } from 'vitest';

import { environment } from '@env';
import { AuthPromptService, AuthRequiredError } from '@app/core/services/auth/auth-prompt';
import { CelebrationService } from '@app/core/services/celebration/celebration';
import { CollectionService } from './collection';
import type { CollectionChangeEvent, CollectionItemResponse } from './collection.model';

const BASE = `${environment.baseUrl}/collection`;

function item(id: string, coverUrl: string | null = null): CollectionItemResponse {
  return { id, media: { coverUrl } } as CollectionItemResponse;
}

describe('CollectionService', () => {
  let service: CollectionService;
  let http: HttpTestingController;
  let require: ReturnType<typeof vi.fn>;
  let fire: ReturnType<typeof vi.fn>;
  let changes: CollectionChangeEvent[];

  beforeEach(() => {
    require = vi.fn().mockReturnValue(true);
    fire = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthPromptService, useValue: { require } },
        { provide: CelebrationService, useValue: { fire } },
      ],
    });
    service = TestBed.inject(CollectionService);
    http = TestBed.inject(HttpTestingController);
    changes = [];
    service.changes.subscribe((event) => changes.push(event));
  });

  afterEach(() => http.verify());

  describe('list', () => {
    it('defaults to the first page of 20 and sends no optional filter', () => {
      service.list().subscribe();

      const req = http.expectOne((r) => r.url === BASE);
      expect(req.request.params.toString()).toBe('page=0&size=20');
      req.flush({ content: [] });
    });

    it('repeats multi-value filters and sends flags only when set', () => {
      service
        .list({
          page: 2,
          size: 50,
          status: ['done', 'ongoing'],
          mediaType: ['movie', 'anime'],
          includeUnrated: false,
          minRating: 0,
          maxRating: 8,
          search: 'dune',
          sortBy: 'rating',
          sortDirection: 'desc',
          hasNote: false,
        })
        .subscribe();

      const params = http.expectOne((r) => r.url === BASE).request.params;
      expect(params.getAll('status')).toEqual(['done', 'ongoing']);
      expect(params.getAll('mediaType')).toEqual(['movie', 'anime']);
      expect(params.get('page')).toBe('2');
      expect(params.get('size')).toBe('50');
      expect(params.get('includeUnrated')).toBe('false');
      expect(params.get('minRating')).toBe('0');
      expect(params.get('maxRating')).toBe('8');
      expect(params.get('search')).toBe('dune');
      expect(params.get('sortBy')).toBe('rating');
      expect(params.get('sortDirection')).toBe('desc');
      expect(params.has('hasNote')).toBe(false);
    });

    it('reads another user shelf from their public collection', () => {
      service.listForUser('kowo').subscribe();

      http.expectOne((r) => r.url === `${environment.baseUrl}/users/kowo/collection`).flush({});
    });
  });

  it('lookupBatch answers an empty map without calling the backend', () => {
    let result: unknown;
    service.lookupBatch([]).subscribe((value) => (result = value));

    expect(result).toEqual({});
    http.expectNone(`${BASE}/lookup-batch`);
  });

  it('lookup sends the title reference as query params', () => {
    service.lookup('tmdb', 'movie', '603').subscribe();

    const req = http.expectOne((r) => r.url === `${BASE}/lookup`);
    expect(req.request.params.toString()).toBe('provider=tmdb&mediaType=movie&externalId=603');
    req.flush(null);
  });

  it.each<[string, (s: CollectionService) => Observable<unknown>]>([
    [
      'create',
      (s) => s.create({ externalId: '1', provider: 'tmdb', mediaType: 'movie', status: 'planned' }),
    ],
    ['update', (s) => s.update('i1', { status: 'done' })],
    ['remove', (s) => s.remove('i1')],
    ['bulkUpdate', (s) => s.bulkUpdate({ ids: ['i1'] })],
    ['bulkRemove', (s) => s.bulkRemove(['i1'])],
    ['clearAll', (s) => s.clearAll()],
  ])('%s asks a guest to sign in and never calls the backend', (_name, call) => {
    require.mockReturnValue(false);
    let error: unknown;

    call(service).subscribe({ error: (e: unknown) => (error = e) });

    expect(error).toBeInstanceOf(AuthRequiredError);
    expect(changes).toEqual([]);
  });

  it('create announces the new item without celebrating', () => {
    const created = item('i1', 'cover.jpg');
    service
      .create({ externalId: '1', provider: 'tmdb', mediaType: 'movie', status: 'planned' })
      .subscribe();

    http.expectOne({ method: 'POST', url: BASE }).flush(created);

    expect(changes).toEqual([{ type: 'created', item: created }]);
    expect(fire).not.toHaveBeenCalled();
  });

  it('a failed write announces nothing', () => {
    service.remove('i1').subscribe({ error: () => undefined });

    http.expectOne(`${BASE}/i1`).flush(null, { status: 500, statusText: 'Server Error' });

    expect(changes).toEqual([]);
  });

  describe('update', () => {
    it.each([
      [{ status: 'done' as const }, 'done'],
      [{ rating: 10 }, 'rated'],
      [{ status: 'done' as const, rating: 10 }, 'done'],
    ])('celebrates %o with %s', (request, kind) => {
      service.update('i1', request).subscribe();
      http.expectOne(`${BASE}/i1`).flush(item('i1'));

      expect(fire).toHaveBeenCalledExactlyOnceWith(kind);
    });

    it('announces the updated item without celebrating an ordinary change', () => {
      const updated = item('i1');
      service.update('i1', { rating: 7 }).subscribe();

      const req = http.expectOne(`${BASE}/i1`);
      expect(req.request.method).toBe('PUT');
      req.flush(updated);

      expect(changes).toEqual([{ type: 'updated', item: updated }]);
      expect(fire).not.toHaveBeenCalled();
    });
  });

  it.each<
    [
      string,
      (s: CollectionService) => Observable<unknown>,
      string,
      string,
      CollectionItemResponse | CollectionItemResponse[] | null,
      CollectionChangeEvent,
    ]
  >([
    ['remove', (s) => s.remove('i1'), 'DELETE', `${BASE}/i1`, null, { type: 'removed', id: 'i1' }],
    [
      'bulkRemove',
      (s) => s.bulkRemove(['i1', 'i2']),
      'POST',
      `${BASE}/bulk-delete`,
      null,
      { type: 'bulkRemoved', ids: ['i1', 'i2'] },
    ],
    [
      'bulkUpdate',
      (s) => s.bulkUpdate({ ids: ['i1'], status: 'done' }),
      'PATCH',
      `${BASE}/bulk`,
      [item('i1')],
      { type: 'bulkUpdated', items: [item('i1')] },
    ],
    ['clearAll', (s) => s.clearAll(), 'DELETE', BASE, null, { type: 'cleared' }],
    [
      'refreshItem',
      (s) => s.refreshItem('i1'),
      'GET',
      `${BASE}/i1`,
      item('i1'),
      { type: 'updated', item: item('i1') },
    ],
  ])(
    '%s announces its change once the backend confirms',
    (_name, call, method, url, body, event) => {
      call(service).subscribe();
      expect(changes).toEqual([]);

      http.expectOne({ method, url }).flush(body);

      expect(changes).toEqual([event]);
    },
  );
});
