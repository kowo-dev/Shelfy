import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { EditableCreation } from '../collect/collect.model';
import { communityParams } from '../community/community';
import type { CommunityQuery } from '../community/community.model';
import type {
  CommentItem,
  CommentSortMode,
  CommentVoteValue,
} from '@shared/ui/comments/comments.model';
import type {
  AddVersusClipRequest,
  CreateVersusPoolRequest,
  PagedResponse,
  StartVersusSessionResponse,
  VersusEntry,
  VersusMatchResponse,
  VersusMediaReference,
  VersusFollowedSession,
  VersusPoolCollaboratorResponse,
  VersusPoolResponse,
  VersusPoolResultsResponse,
  VersusPoolSummaryResponse,
  VersusSessionResult,
  UpdateVersusClipRequest,
} from './versus.model';

@Injectable({ providedIn: 'root' })
export class VersusService {
  private readonly http = inject(HttpClient);
  private readonly poolsUrl = `${environment.baseUrl}/versus/pools`;
  private readonly sessionsUrl = `${environment.baseUrl}/versus/sessions`;

  createPool(request: CreateVersusPoolRequest): Observable<VersusPoolResponse> {
    return this.http.post<VersusPoolResponse>(this.poolsUrl, request);
  }

  updatePool(poolId: string, request: CreateVersusPoolRequest): Observable<VersusPoolResponse> {
    return this.http.put<VersusPoolResponse>(`${this.poolsUrl}/${poolId}`, request);
  }

  getPool(poolId: string): Observable<VersusPoolResponse> {
    return this.http.get<VersusPoolResponse>(`${this.poolsUrl}/${poolId}`);
  }

  browsePools(
    page = 0,
    size = 20,
    query: CommunityQuery = {},
  ): Observable<PagedResponse<VersusPoolSummaryResponse>> {
    return this.http.get<PagedResponse<VersusPoolSummaryResponse>>(this.poolsUrl, {
      params: communityParams(page, size, query),
    });
  }

  profilePools(
    username: string,
    page = 0,
    size = 50,
    q = '',
  ): Observable<PagedResponse<VersusPoolSummaryResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q) params = params.set('q', q);
    return this.http.get<PagedResponse<VersusPoolSummaryResponse>>(
      `${this.poolsUrl}/profile/${encodeURIComponent(username)}`,
      { params },
    );
  }

  addItem(poolId: string, media: VersusMediaReference): Observable<VersusPoolResponse> {
    return this.http.post<VersusPoolResponse>(`${this.poolsUrl}/${poolId}/items`, media);
  }

  addItems(poolId: string, items: VersusMediaReference[]): Observable<VersusPoolResponse> {
    return this.http.post<VersusPoolResponse>(`${this.poolsUrl}/${poolId}/items/batch`, {
      items,
    });
  }

  addClip(poolId: string, request: AddVersusClipRequest): Observable<VersusPoolResponse> {
    return this.http.post<VersusPoolResponse>(`${this.poolsUrl}/${poolId}/clips`, request);
  }

  updateClip(
    poolId: string,
    entryId: string,
    request: UpdateVersusClipRequest,
  ): Observable<VersusPoolResponse> {
    return this.http.patch<VersusPoolResponse>(
      `${this.poolsUrl}/${poolId}/items/${entryId}`,
      request,
    );
  }

  resolveClip(url: string): Observable<VersusEntry> {
    return this.http.post<VersusEntry>(`${environment.baseUrl}/versus/clips/resolve`, { url });
  }

  editable(title?: VersusMediaReference): Observable<EditableCreation[]> {
    return this.http.get<EditableCreation[]>(`${this.poolsUrl}/editable`, {
      params: title ? { ...title } : {},
    });
  }

  removeItem(poolId: string, entryId: string): Observable<VersusPoolResponse> {
    return this.http.delete<VersusPoolResponse>(`${this.poolsUrl}/${poolId}/items/${entryId}`);
  }

  removeItems(poolId: string, entryIds: string[]): Observable<VersusPoolResponse> {
    return this.http.post<VersusPoolResponse>(`${this.poolsUrl}/${poolId}/items/remove`, {
      entryIds,
    });
  }

  getResults(poolId: string): Observable<VersusPoolResultsResponse> {
    return this.http.get<VersusPoolResultsResponse>(`${this.poolsUrl}/${poolId}/results`);
  }

  like(poolId: string): Observable<VersusPoolResponse> {
    return this.http.post<VersusPoolResponse>(`${this.poolsUrl}/${poolId}/likes`, {});
  }

  unlike(poolId: string): Observable<VersusPoolResponse> {
    return this.http.delete<VersusPoolResponse>(`${this.poolsUrl}/${poolId}/likes`);
  }

  comment(poolId: string, content: string, parentCommentId?: string): Observable<CommentItem> {
    return this.http.post<CommentItem>(`${this.poolsUrl}/${poolId}/comments`, {
      content,
      parentCommentId,
    });
  }

  comments(
    poolId: string,
    page: number,
    size = 10,
    sort: CommentSortMode = 'relevance',
  ): Observable<PagedResponse<CommentItem>> {
    return this.http.get<PagedResponse<CommentItem>>(`${this.poolsUrl}/${poolId}/comments`, {
      params: new HttpParams().set('page', page).set('size', size).set('sort', sort),
    });
  }

  updateComment(poolId: string, commentId: string, content: string): Observable<CommentItem> {
    return this.http.put<CommentItem>(`${this.poolsUrl}/${poolId}/comments/${commentId}`, {
      content,
    });
  }

  deleteComment(poolId: string, commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.poolsUrl}/${poolId}/comments/${commentId}`);
  }

  voteComment(poolId: string, commentId: string, value: CommentVoteValue): Observable<CommentItem> {
    return this.http.put<CommentItem>(`${this.poolsUrl}/${poolId}/comments/${commentId}/vote`, {
      value,
    });
  }

  removeCommentVote(poolId: string, commentId: string): Observable<CommentItem> {
    return this.http.delete<CommentItem>(`${this.poolsUrl}/${poolId}/comments/${commentId}/vote`);
  }

  startSession(poolId: string): Observable<StartVersusSessionResponse> {
    return this.http.post<StartVersusSessionResponse>(this.sessionsUrl, { poolId });
  }

  getSession(sessionId: string): Observable<StartVersusSessionResponse> {
    return this.http.get<StartVersusSessionResponse>(`${this.sessionsUrl}/${sessionId}`);
  }

  submitPick(sessionId: string, winnerEntryId: string): Observable<StartVersusSessionResponse> {
    return this.http.post<StartVersusSessionResponse>(`${this.sessionsUrl}/${sessionId}/picks`, {
      winnerEntryId,
    });
  }

  undoPick(sessionId: string): Observable<StartVersusSessionResponse> {
    return this.http.post<StartVersusSessionResponse>(`${this.sessionsUrl}/${sessionId}/undo`, {});
  }

  currentSession(poolId: string): Observable<StartVersusSessionResponse | null> {
    return this.http.get<StartVersusSessionResponse | null>(`${this.sessionsUrl}/current`, {
      params: { poolId },
    });
  }

  sessionResult(sessionId: string): Observable<VersusSessionResult> {
    return this.http.get<VersusSessionResult>(`${this.sessionsUrl}/${sessionId}/result`);
  }

  followedSessions(poolId: string): Observable<VersusFollowedSession[]> {
    return this.http.get<VersusFollowedSession[]>(`${this.sessionsUrl}/following`, {
      params: { poolId },
    });
  }

  getBracket(sessionId: string): Observable<VersusMatchResponse[]> {
    return this.http.get<VersusMatchResponse[]>(`${this.sessionsUrl}/${sessionId}/bracket`);
  }
  deletePool(poolId: string): Observable<void> {
    return this.http.delete<void>(`${this.poolsUrl}/${poolId}`);
  }

  inviteCollaborator(poolId: string, userId: string): Observable<VersusPoolCollaboratorResponse> {
    return this.http.post<VersusPoolCollaboratorResponse>(
      `${this.poolsUrl}/${poolId}/collaborators`,
      { userId },
    );
  }

  acceptCollaboratorInvite(poolId: string): Observable<VersusPoolCollaboratorResponse> {
    return this.http.put<VersusPoolCollaboratorResponse>(
      `${this.poolsUrl}/${poolId}/collaborators/accept`,
      {},
    );
  }

  declineCollaboratorInvite(poolId: string): Observable<void> {
    return this.http.put<void>(`${this.poolsUrl}/${poolId}/collaborators/decline`, {});
  }

  removeCollaborator(poolId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.poolsUrl}/${poolId}/collaborators/${userId}`);
  }
}
