import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  CreateMediaListRequest,
  MediaListCollaboratorResponse,
  MediaListCommentResponse,
  MediaListResponse,
  MediaListSummaryResponse,
  UpdateMediaListDetailsRequest,
} from './lists.model';
import type { MediaType } from '../collection/collection.model';
import type { EditableCreation } from '../collect/collect.model';
import type { PagedResponse } from '../collection/collection.model';
import { communityParams } from '../community/community';
import type { CommunityQuery } from '../community/community.model';
@Injectable({ providedIn: 'root' })
export class ListsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/lists`;
  create(request: CreateMediaListRequest): Observable<MediaListResponse> {
    return this.http.post<MediaListResponse>(this.baseUrl, request);
  }
  browse(
    page = 0,
    size = 20,
    query: CommunityQuery = {},
  ): Observable<PagedResponse<MediaListSummaryResponse>> {
    return this.http.get<PagedResponse<MediaListSummaryResponse>>(this.baseUrl, {
      params: communityParams(page, size, query),
    });
  }
  update(id: string, request: CreateMediaListRequest): Observable<MediaListResponse> {
    return this.http.put<MediaListResponse>(`${this.baseUrl}/${id}`, request);
  }
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
  get(id: string): Observable<MediaListResponse> {
    return this.http.get<MediaListResponse>(`${this.baseUrl}/${id}`);
  }
  forProfile(username: string, q = ''): Observable<PagedResponse<MediaListResponse>> {
    return this.http.get<PagedResponse<MediaListResponse>>(`${this.baseUrl}/profile/${username}`, {
      params: q ? { q } : {},
    });
  }
  like(id: string): Observable<MediaListResponse> {
    return this.http.post<MediaListResponse>(`${this.baseUrl}/${id}/likes`, {});
  }
  unlike(id: string): Observable<MediaListResponse> {
    return this.http.delete<MediaListResponse>(`${this.baseUrl}/${id}/likes`);
  }
  comment(
    id: string,
    content: string,
    parentCommentId?: string,
  ): Observable<MediaListCommentResponse> {
    return this.http.post<MediaListCommentResponse>(`${this.baseUrl}/${id}/comments`, {
      content,
      parentCommentId,
    });
  }
  comments(
    id: string,
    page: number,
    size = 10,
    sort: 'relevance' | 'recent' = 'relevance',
  ): Observable<PagedResponse<MediaListCommentResponse>> {
    return this.http.get<PagedResponse<MediaListCommentResponse>>(
      `${this.baseUrl}/${id}/comments`,
      {
        params: new HttpParams().set('page', page).set('size', size).set('sort', sort),
      },
    );
  }
  updateComment(
    id: string,
    commentId: string,
    content: string,
  ): Observable<MediaListCommentResponse> {
    return this.http.put<MediaListCommentResponse>(`${this.baseUrl}/${id}/comments/${commentId}`, {
      content,
    });
  }
  deleteComment(id: string, commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/comments/${commentId}`);
  }
  voteComment(id: string, commentId: string, value: 1 | -1): Observable<MediaListCommentResponse> {
    return this.http.put<MediaListCommentResponse>(
      `${this.baseUrl}/${id}/comments/${commentId}/vote`,
      { value },
    );
  }
  removeCommentVote(id: string, commentId: string): Observable<MediaListCommentResponse> {
    return this.http.delete<MediaListCommentResponse>(
      `${this.baseUrl}/${id}/comments/${commentId}/vote`,
    );
  }
  addItem(
    id: string,
    media: { provider: string; mediaType: MediaType; externalId: string },
  ): Observable<MediaListResponse> {
    return this.http.post<MediaListResponse>(`${this.baseUrl}/${id}/items`, media);
  }
  editable(title?: { provider: string; mediaType: MediaType; externalId: string }) {
    return this.http.get<EditableCreation[]>(`${this.baseUrl}/editable`, {
      params: title ? { ...title } : {},
    });
  }
  removeItem(id: string, mediaId: string): Observable<MediaListResponse> {
    return this.http.delete<MediaListResponse>(`${this.baseUrl}/${id}/items/${mediaId}`);
  }
  updateDetails(id: string, request: UpdateMediaListDetailsRequest): Observable<MediaListResponse> {
    return this.http.patch<MediaListResponse>(`${this.baseUrl}/${id}`, request);
  }
  addItems(
    id: string,
    media: { provider: string; mediaType: MediaType; externalId: string }[],
  ): Observable<MediaListResponse> {
    return this.http.post<MediaListResponse>(`${this.baseUrl}/${id}/items/batch`, { media });
  }
  removeItems(id: string, mediaIds: string[]): Observable<MediaListResponse> {
    return this.http.post<MediaListResponse>(`${this.baseUrl}/${id}/items/remove`, { mediaIds });
  }
  reorder(id: string, mediaIds: string[]): Observable<MediaListResponse> {
    return this.http.put<MediaListResponse>(`${this.baseUrl}/${id}/items/order`, { mediaIds });
  }
  inviteCollaborator(id: string, userId: string): Observable<MediaListCollaboratorResponse> {
    return this.http.post<MediaListCollaboratorResponse>(`${this.baseUrl}/${id}/collaborators`, {
      userId,
    });
  }
  acceptCollaboratorInvite(id: string): Observable<MediaListCollaboratorResponse> {
    return this.http.put<MediaListCollaboratorResponse>(
      `${this.baseUrl}/${id}/collaborators/accept`,
      {},
    );
  }
  declineCollaboratorInvite(id: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/collaborators/decline`, {});
  }
  removeCollaborator(id: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/collaborators/${userId}`);
  }
}
