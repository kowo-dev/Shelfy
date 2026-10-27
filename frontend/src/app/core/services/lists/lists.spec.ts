import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import type {
  CreateMediaListRequest,
  MediaListCollaboratorResponse,
  MediaListCommentResponse,
  MediaListResponse,
} from './lists.model';
import { ListsService } from './lists';

const BASE_URL = `${environment.baseUrl}/lists`;

function listResponse(overrides: Partial<MediaListResponse> = {}): MediaListResponse {
  return {
    id: 'list1',
    userId: 'u1',
    name: 'Favorites',
    description: null,
    visibility: 'public',
    tags: [],
    media: [],
    items: [],
    isLikedByViewer: false,
    likeCount: 0,
    completion: {
      total: 0,
      inCollection: 0,
      planned: 0,
      ongoing: 0,
      done: 0,
      dropped: 0,
      completed: 0,
      percentage: 0,
    },
    comments: [],
    commentCount: 0,
    collaborators: [],
    pendingInvites: [],
    canEditItems: true,
    viewerCollaboratorStatus: null,
    creatorUsername: null,
    creatorAvatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function commentResponse(
  overrides: Partial<MediaListCommentResponse> = {},
): MediaListCommentResponse {
  return {
    id: 'c1',
    authorId: 'u1',
    authorUsername: 'kowo',
    authorAvatarUrl: null,
    content: 'nice list',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    upvotes: 0,
    downvotes: 0,
    myVote: null,
    parentCommentId: null,
    isDeleted: false,
    replies: [],
    ...overrides,
  };
}

function collaboratorResponse(
  overrides: Partial<MediaListCollaboratorResponse> = {},
): MediaListCollaboratorResponse {
  return {
    id: 'collab1',
    listId: 'list1',
    userId: 'u2',
    username: 'friend',
    displayName: null,
    avatarUrl: null,
    status: 'PENDING',
    invitedBy: 'u1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ListsService', () => {
  let service: ListsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ListsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('create() posts the list request to the base URL', () => {
    const request: CreateMediaListRequest = {
      name: 'Favorites',
      visibility: 'public',
      tags: [],
      media: [],
    };
    let result: MediaListResponse | undefined;
    service.create(request).subscribe((r) => (result = r));

    const req = httpMock.expectOne(BASE_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    const response = listResponse();
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('update() puts the list request to /lists/:id', () => {
    const request: CreateMediaListRequest = {
      name: 'Updated',
      visibility: 'private',
      tags: ['a'],
      media: [],
    };
    service.update('list1', request).subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush(listResponse({ name: 'Updated' }));
  });

  it('get() requests /lists/:id', () => {
    let result: MediaListResponse | undefined;
    service.get('list1').subscribe((r) => (result = r));

    const response = listResponse();
    httpMock.expectOne(`${BASE_URL}/list1`).flush(response);

    expect(result).toEqual(response);
  });

  it('forProfile() requests /lists/profile/:username', () => {
    let result: PagedResponse<MediaListResponse> | undefined;
    service.forProfile('kowo').subscribe((r) => (result = r));

    const response: PagedResponse<MediaListResponse> = {
      content: [listResponse()],
      page: 0,
      size: 20,
      totalElements: 1,
    };
    httpMock.expectOne(`${BASE_URL}/profile/kowo`).flush(response);

    expect(result).toEqual(response);
  });

  it('like() posts to /lists/:id/likes', () => {
    service.like('list1').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/likes`);
    expect(req.request.method).toBe('POST');
    req.flush(listResponse({ isLikedByViewer: true, likeCount: 1 }));
  });

  it('unlike() deletes /lists/:id/likes', () => {
    service.unlike('list1').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/likes`);
    expect(req.request.method).toBe('DELETE');
    req.flush(listResponse({ isLikedByViewer: false, likeCount: 0 }));
  });

  it('comment() posts content and an optional parentCommentId', () => {
    service.comment('list1', 'hi', 'parent1').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/comments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ content: 'hi', parentCommentId: 'parent1' });
    req.flush(commentResponse());
  });

  it('comments() sends page, size and sort params with defaults', () => {
    service.comments('list1', 0).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${BASE_URL}/list1/comments`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('sort')).toBe('relevance');
    req.flush({ content: [], page: 0, size: 10, totalElements: 0 });
  });

  it('updateComment() puts the new content', () => {
    service.updateComment('list1', 'c1', 'edited').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/comments/c1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ content: 'edited' });
    req.flush(commentResponse({ content: 'edited' }));
  });

  it('deleteComment() removes /lists/:id/comments/:commentId', () => {
    let done = false;
    service.deleteComment('list1', 'c1').subscribe(() => (done = true));

    const req = httpMock.expectOne(`${BASE_URL}/list1/comments/c1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('voteComment() puts the vote value', () => {
    service.voteComment('list1', 'c1', -1).subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/comments/c1/vote`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ value: -1 });
    req.flush(commentResponse({ myVote: -1 }));
  });

  it('removeCommentVote() deletes the vote', () => {
    service.removeCommentVote('list1', 'c1').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/comments/c1/vote`);
    expect(req.request.method).toBe('DELETE');
    req.flush(commentResponse({ myVote: null }));
  });

  it('addItem() posts media details to /lists/:id/items', () => {
    const media = { provider: 'tmdb', mediaType: 'movie' as const, externalId: '27205' };
    service.addItem('list1', media).subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/items`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(media);
    req.flush(listResponse());
  });

  it('removeItem() deletes /lists/:id/items/:mediaId', () => {
    service.removeItem('list1', 'media1').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/items/media1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(listResponse());
  });

  it('updateDetails() patches /lists/:id without titles', () => {
    const request = { name: 'Renamed', visibility: 'public' as const, tags: ['cosy'] };
    service.updateDetails('list1', request).subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(request);
    req.flush(listResponse());
  });

  it('addItems() posts every title to /lists/:id/items/batch', () => {
    const media = [{ provider: 'tmdb', mediaType: 'movie' as const, externalId: '27205' }];
    service.addItems('list1', media).subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/items/batch`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ media });
    req.flush(listResponse());
  });

  it('removeItems() posts the media ids to /lists/:id/items/remove', () => {
    service.removeItems('list1', ['m1', 'm2']).subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/items/remove`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mediaIds: ['m1', 'm2'] });
    req.flush(listResponse());
  });

  it('reorder() puts the full order to /lists/:id/items/order', () => {
    service.reorder('list1', ['m2', 'm1']).subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/items/order`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ mediaIds: ['m2', 'm1'] });
    req.flush(listResponse());
  });

  it('inviteCollaborator() posts the userId', () => {
    service.inviteCollaborator('list1', 'u2').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/collaborators`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'u2' });
    req.flush(collaboratorResponse());
  });

  it('acceptCollaboratorInvite() puts to /lists/:id/collaborators/accept', () => {
    service.acceptCollaboratorInvite('list1').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/list1/collaborators/accept`);
    expect(req.request.method).toBe('PUT');
    req.flush(collaboratorResponse({ status: 'ACCEPTED' }));
  });

  it('declineCollaboratorInvite() puts to /lists/:id/collaborators/decline', () => {
    let done = false;
    service.declineCollaboratorInvite('list1').subscribe(() => (done = true));

    const req = httpMock.expectOne(`${BASE_URL}/list1/collaborators/decline`);
    expect(req.request.method).toBe('PUT');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('removeCollaborator() deletes /lists/:id/collaborators/:userId', () => {
    let done = false;
    service.removeCollaborator('list1', 'u2').subscribe(() => (done = true));

    const req = httpMock.expectOne(`${BASE_URL}/list1/collaborators/u2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('propagates a 404 when the list does not exist', () => {
    let error: unknown;
    service.get('missing').subscribe({ error: (err) => (error = err) });

    httpMock.expectOne(`${BASE_URL}/missing`).flush(null, { status: 404, statusText: 'Not Found' });

    expect((error as { status: number }).status).toBe(404);
  });
});
