import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import type {
  CommentItem,
  CommentSortMode,
  CommentVoteValue,
} from '@shared/ui/comments/comments.model';

@Injectable({ providedIn: 'root' })
export class ReviewCommentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/reviews`;

  comment(reviewId: string, content: string, parentCommentId?: string): Observable<CommentItem> {
    return this.http.post<CommentItem>(`${this.baseUrl}/${reviewId}/comments`, {
      content,
      parentCommentId,
    });
  }

  comments(
    reviewId: string,
    page: number,
    size = 10,
    sort: CommentSortMode = 'relevance',
  ): Observable<PagedResponse<CommentItem>> {
    return this.http.get<PagedResponse<CommentItem>>(`${this.baseUrl}/${reviewId}/comments`, {
      params: new HttpParams().set('page', page).set('size', size).set('sort', sort),
    });
  }

  updateComment(reviewId: string, commentId: string, content: string): Observable<CommentItem> {
    return this.http.put<CommentItem>(`${this.baseUrl}/${reviewId}/comments/${commentId}`, {
      content,
    });
  }

  deleteComment(reviewId: string, commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${reviewId}/comments/${commentId}`);
  }

  voteComment(
    reviewId: string,
    commentId: string,
    value: CommentVoteValue,
  ): Observable<CommentItem> {
    return this.http.put<CommentItem>(`${this.baseUrl}/${reviewId}/comments/${commentId}/vote`, {
      value,
    });
  }

  removeCommentVote(reviewId: string, commentId: string): Observable<CommentItem> {
    return this.http.delete<CommentItem>(`${this.baseUrl}/${reviewId}/comments/${commentId}/vote`);
  }
}
