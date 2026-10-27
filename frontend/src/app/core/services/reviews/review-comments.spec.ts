import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import type { CommentItem } from '@shared/ui/comments/comments.model';
import { ReviewCommentsService } from './review-comments';

const BASE_URL = `${environment.baseUrl}/reviews`;

function comment(overrides: Partial<CommentItem> = {}): CommentItem {
  return {
    id: 'c1',
    authorId: 'u1',
    authorUsername: 'kowo',
    authorAvatarUrl: null,
    content: 'great review',
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

describe('ReviewCommentsService', () => {
  let service: ReviewCommentsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReviewCommentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('comment() posts content and an optional parentCommentId', () => {
    let result: CommentItem | undefined;
    service.comment('review1', 'nice', 'parent1').subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${BASE_URL}/review1/comments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ content: 'nice', parentCommentId: 'parent1' });
    const response = comment();
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('comments() sends page, size and sort params with defaults', () => {
    let result: PagedResponse<CommentItem> | undefined;
    service.comments('review1', 0).subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url === `${BASE_URL}/review1/comments`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('sort')).toBe('relevance');

    const response: PagedResponse<CommentItem> = {
      content: [comment()],
      page: 0,
      size: 10,
      totalElements: 1,
    };
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('comments() sends a custom size and sort mode', () => {
    service.comments('review1', 2, 5, 'recent').subscribe();

    const req = httpMock.expectOne((r) => r.url === `${BASE_URL}/review1/comments`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('5');
    expect(req.request.params.get('sort')).toBe('recent');
    req.flush({ content: [], page: 2, size: 5, totalElements: 0 });
  });

  it('updateComment() puts the new content', () => {
    service.updateComment('review1', 'c1', 'edited').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/review1/comments/c1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ content: 'edited' });
    req.flush(comment({ content: 'edited' }));
  });

  it('deleteComment() removes /reviews/:id/comments/:commentId', () => {
    let done = false;
    service.deleteComment('review1', 'c1').subscribe(() => (done = true));

    const req = httpMock.expectOne(`${BASE_URL}/review1/comments/c1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('voteComment() puts the vote value', () => {
    service.voteComment('review1', 'c1', 1).subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/review1/comments/c1/vote`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ value: 1 });
    req.flush(comment({ myVote: 1 }));
  });

  it('removeCommentVote() deletes the vote', () => {
    service.removeCommentVote('review1', 'c1').subscribe();

    const req = httpMock.expectOne(`${BASE_URL}/review1/comments/c1/vote`);
    expect(req.request.method).toBe('DELETE');
    req.flush(comment({ myVote: null }));
  });

  it('propagates a 404 when the review does not exist', () => {
    let error: unknown;
    service.comments('missing', 0).subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne((r) => r.url === `${BASE_URL}/missing/comments`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect((error as { status: number }).status).toBe(404);
  });
});
