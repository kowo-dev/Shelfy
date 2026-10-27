import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { MediaResponse } from '@app/core/services/collection/collection.model';
import type {
  CreateVersusPoolRequest,
  StartVersusSessionResponse,
  VersusEntry,
  VersusMatchResponse,
  VersusPoolResponse,
  VersusPoolResultsResponse,
  VersusPoolSummaryResponse,
} from './versus.model';
import { VersusService } from './versus';

const POOLS_URL = `${environment.baseUrl}/versus/pools`;
const SESSIONS_URL = `${environment.baseUrl}/versus/sessions`;

function media(overrides: Partial<MediaResponse> = {}): MediaResponse {
  return {
    id: 'm1',
    canonicalWorkId: 'cw1',
    externalId: '1',
    provider: 'tmdb',
    mediaType: 'movie',
    title: 'Movie 1',
    coverUrl: null,
    metadata: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function entry(overrides: Partial<MediaResponse> = {}): VersusEntry {
  const m = media(overrides);
  return { id: `e-${m.id}`, title: m.title, coverUrl: m.coverUrl, media: m, clip: null };
}

function poolResponse(overrides: Partial<VersusPoolResponse> = {}): VersusPoolResponse {
  return {
    id: 'pool1',
    userId: 'u1',
    name: 'Best movies',
    description: null,
    visibility: 'public',
    entries: [entry()],
    canEdit: true,
    isOwner: true,
    isLikedByViewer: false,
    likeCount: 0,
    comments: [],
    commentCount: 0,
    creatorUsername: null,
    creatorAvatarUrl: null,
    collaborators: [],
    pendingInvites: [],
    viewerCollaboratorStatus: null,
    source: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function summaryResponse(
  overrides: Partial<VersusPoolSummaryResponse> = {},
): VersusPoolSummaryResponse {
  return {
    id: 'pool1',
    userId: 'u1',
    name: 'Best movies',
    description: null,
    visibility: 'public',
    itemCount: 4,
    previewEntries: [],
    likeCount: 0,
    commentCount: 0,
    creatorUsername: null,
    creatorAvatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function matchResponse(overrides: Partial<VersusMatchResponse> = {}): VersusMatchResponse {
  return {
    id: 'match1',
    round: 1,
    slotIndex: 0,
    entryA: entry(),
    entryB: entry({ id: 'm2' }),
    winnerEntryId: null,
    isDecided: false,
    ...overrides,
  };
}

function sessionResponse(
  overrides: Partial<StartVersusSessionResponse> = {},
): StartVersusSessionResponse {
  return {
    sessionId: 'session1',
    poolId: 'pool1',
    status: 'in_progress',
    bracketSize: 4,
    roundsTotal: 2,
    currentRound: 1,
    currentMatch: matchResponse(),
    winnerEntry: null,
    ...overrides,
  };
}

describe('VersusService', () => {
  let service: VersusService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VersusService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('createPool() posts the pool request to the base URL', () => {
    const request: CreateVersusPoolRequest = { name: 'Best movies', visibility: 'public' };
    let result: VersusPoolResponse | undefined;
    service.createPool(request).subscribe((r) => (result = r));

    const req = httpMock.expectOne(POOLS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    const response = poolResponse();
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('updatePool() puts the pool request to /versus/pools/:id', () => {
    const request: CreateVersusPoolRequest = { name: 'Updated', visibility: 'private' };
    service.updatePool('pool1', request).subscribe();

    const req = httpMock.expectOne(`${POOLS_URL}/pool1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush(poolResponse({ name: 'Updated' }));
  });

  it('getPool() requests /versus/pools/:id', () => {
    let result: VersusPoolResponse | undefined;
    service.getPool('pool1').subscribe((r) => (result = r));

    const response = poolResponse();
    httpMock.expectOne(`${POOLS_URL}/pool1`).flush(response);

    expect(result).toEqual(response);
  });

  it('browsePools() sends page and size params with defaults', () => {
    service.browsePools().subscribe();

    const req = httpMock.expectOne((r) => r.url === POOLS_URL);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ content: [summaryResponse()], page: 0, size: 20, totalElements: 1 });
  });

  it('profilePools() requests the public pools of a user, 50 at a time', () => {
    service.profilePools('lea_moreau').subscribe();

    const req = httpMock.expectOne((r) => r.url === `${POOLS_URL}/profile/lea_moreau`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('50');
    req.flush({ content: [summaryResponse()], page: 0, size: 50, totalElements: 1 });
  });

  it('addItem() posts media details to /versus/pools/:id/items', () => {
    const ref = { provider: 'tmdb', mediaType: 'movie' as const, externalId: '27205' };
    service.addItem('pool1', ref).subscribe();

    const req = httpMock.expectOne(`${POOLS_URL}/pool1/items`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(ref);
    req.flush(poolResponse());
  });

  it('removeItem() deletes /versus/pools/:id/items/:entryId', () => {
    service.removeItem('pool1', 'media1').subscribe();

    const req = httpMock.expectOne(`${POOLS_URL}/pool1/items/media1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(poolResponse());
  });

  it('removeItems() posts the entry ids to /versus/pools/:id/items/remove', () => {
    service.removeItems('pool1', ['e1', 'e2']).subscribe();

    const req = httpMock.expectOne(`${POOLS_URL}/pool1/items/remove`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ entryIds: ['e1', 'e2'] });
    req.flush(poolResponse());
  });

  it('like() posts to /versus/pools/:id/likes', () => {
    service.like('pool1').subscribe();

    const req = httpMock.expectOne(`${POOLS_URL}/pool1/likes`);
    expect(req.request.method).toBe('POST');
    req.flush(poolResponse());
  });

  it('unlike() deletes /versus/pools/:id/likes', () => {
    service.unlike('pool1').subscribe();

    const req = httpMock.expectOne(`${POOLS_URL}/pool1/likes`);
    expect(req.request.method).toBe('DELETE');
    req.flush(poolResponse());
  });

  it('comment() posts content to /versus/pools/:id/comments', () => {
    service.comment('pool1', 'nice pool', 'parent1').subscribe();

    const req = httpMock.expectOne(`${POOLS_URL}/pool1/comments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ content: 'nice pool', parentCommentId: 'parent1' });
    req.flush({
      id: 'c1',
      authorId: 'u1',
      authorUsername: 'user',
      authorAvatarUrl: null,
      content: 'nice pool',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: null,
      upvotes: 0,
      downvotes: 0,
      myVote: null,
      parentCommentId: null,
      isDeleted: false,
      replies: [],
    });
  });

  it('comments() sends page, size and sort params', () => {
    service.comments('pool1', 1, 5, 'recent').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${POOLS_URL}/pool1/comments` && r.method === 'GET',
    );
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('5');
    expect(req.request.params.get('sort')).toBe('recent');
    req.flush({ content: [], page: 1, size: 5, totalElements: 0 });
  });

  it('deleteComment() deletes /versus/pools/:id/comments/:commentId', () => {
    service.deleteComment('pool1', 'c1').subscribe();

    const req = httpMock.expectOne(`${POOLS_URL}/pool1/comments/c1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getResults() requests /versus/pools/:id/results', () => {
    let result: VersusPoolResultsResponse | undefined;
    service.getResults('pool1').subscribe((r) => (result = r));

    const response: VersusPoolResultsResponse = {
      poolId: 'pool1',
      completedSessionCount: 3,
      ranking: [],
    };
    httpMock.expectOne(`${POOLS_URL}/pool1/results`).flush(response);

    expect(result).toEqual(response);
  });

  it('startSession() posts poolId to /versus/sessions', () => {
    let result: StartVersusSessionResponse | undefined;
    service.startSession('pool1').subscribe((r) => (result = r));

    const req = httpMock.expectOne(SESSIONS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ poolId: 'pool1' });
    const response = sessionResponse();
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('getSession() requests /versus/sessions/:id', () => {
    let result: StartVersusSessionResponse | undefined;
    service.getSession('session1').subscribe((r) => (result = r));

    const response = sessionResponse();
    httpMock.expectOne(`${SESSIONS_URL}/session1`).flush(response);

    expect(result).toEqual(response);
  });

  it('submitPick() posts winnerEntryId to /versus/sessions/:id/picks', () => {
    service.submitPick('session1', 'm1').subscribe();

    const req = httpMock.expectOne(`${SESSIONS_URL}/session1/picks`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ winnerEntryId: 'm1' });
    req.flush(sessionResponse());
  });

  it('addClip() posts the link to /versus/pools/:id/clips', () => {
    const request = { url: 'https://youtu.be/dQw4w9WgXcQ', startSeconds: 30, linkedMedia: null };
    service.addClip('pool1', request).subscribe();

    const req = httpMock.expectOne(`${POOLS_URL}/pool1/clips`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(poolResponse());
  });

  it('resolveClip() posts the link to /versus/clips/resolve', () => {
    service.resolveClip('https://youtu.be/dQw4w9WgXcQ').subscribe();

    const req = httpMock.expectOne(`${environment.baseUrl}/versus/clips/resolve`);
    expect(req.request.body).toEqual({ url: 'https://youtu.be/dQw4w9WgXcQ' });
    req.flush(entry());
  });

  it('getBracket() requests /versus/sessions/:id/bracket', () => {
    let result: VersusMatchResponse[] | undefined;
    service.getBracket('session1').subscribe((r) => (result = r));

    const response = [matchResponse()];
    httpMock.expectOne(`${SESSIONS_URL}/session1/bracket`).flush(response);

    expect(result).toEqual(response);
  });

  it('propagates a 404 when the pool does not exist', () => {
    let error: unknown;
    service.getPool('missing').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne(`${POOLS_URL}/missing`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect((error as { status: number }).status).toBe(404);
  });
});
