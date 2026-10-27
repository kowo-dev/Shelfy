import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, of, Subject, tap, throwError, type Observable } from 'rxjs';
import { environment } from '@env';
import { CelebrationService } from '@app/core/services/celebration/celebration';
import { AuthPromptService, AuthRequiredError } from '@app/core/services/auth/auth-prompt';
import { todayIsoDate } from '@shared/utils/local-date.util';
import type {
  AddToCollectionRequest,
  BulkUpdateCollectionItemRequest,
  CollectionChangeEvent,
  CollectionItemResponse,
  CollectionListParams,
  CollectionStatsResponse,
  MediaType,
  NextEpisodeResponse,
  PagedResponse,
  UpdateCollectionItemRequest,
  UserMediaStatus,
} from './collection.model';

@Injectable({
  providedIn: 'root',
})
export class CollectionService {
  private readonly http = inject(HttpClient);
  private readonly authPrompt = inject(AuthPromptService);
  private readonly celebration = inject(CelebrationService);
  private readonly baseUrl = `${environment.baseUrl}/collection`;

  private readonly changeSubject = new Subject<CollectionChangeEvent>();
  readonly changes = this.changeSubject.asObservable();

  private guarded<T>(factory: () => Observable<T>): Observable<T> {
    return defer(() =>
      this.authPrompt.require() ? factory() : throwError(() => new AuthRequiredError()),
    );
  }

  list(params: CollectionListParams = {}): Observable<PagedResponse<CollectionItemResponse>> {
    return this.http.get<PagedResponse<CollectionItemResponse>>(this.baseUrl, {
      params: this.buildListParams(params),
    });
  }

  listForUser(
    username: string,
    params: CollectionListParams = {},
  ): Observable<PagedResponse<CollectionItemResponse>> {
    return this.http.get<PagedResponse<CollectionItemResponse>>(
      `${environment.baseUrl}/users/${username}/collection`,
      { params: this.buildListParams(params) },
    );
  }

  private buildListParams(params: CollectionListParams): HttpParams {
    let httpParams = new HttpParams().set('page', params.page ?? 0).set('size', params.size ?? 20);
    for (const status of params.status ?? []) {
      httpParams = httpParams.append('status', status);
    }
    for (const mediaType of params.mediaType ?? []) {
      httpParams = httpParams.append('mediaType', mediaType);
    }
    if (params.includeUnrated !== undefined) {
      httpParams = httpParams.set('includeUnrated', params.includeUnrated);
    }
    if (params.minRating !== undefined) {
      httpParams = httpParams.set('minRating', params.minRating);
    }
    if (params.maxRating !== undefined) {
      httpParams = httpParams.set('maxRating', params.maxRating);
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.sortBy) {
      httpParams = httpParams.set('sortBy', params.sortBy);
    }
    if (params.sortDirection) {
      httpParams = httpParams.set('sortDirection', params.sortDirection);
    }
    if (params.hasNote) {
      httpParams = httpParams.set('hasNote', true);
    }
    return httpParams;
  }

  nextEpisodes(): Observable<NextEpisodeResponse[]> {
    return this.http.get<NextEpisodeResponse[]>(`${this.baseUrl}/next-episodes`);
  }

  stats(): Observable<CollectionStatsResponse> {
    return this.http.get<CollectionStatsResponse>(`${this.baseUrl}/stats`);
  }

  statsForUser(username: string): Observable<CollectionStatsResponse> {
    return this.http.get<CollectionStatsResponse>(
      `${environment.baseUrl}/users/${username}/collection/stats`,
    );
  }

  getItem(id: string): Observable<CollectionItemResponse> {
    return this.http.get<CollectionItemResponse>(`${this.baseUrl}/${id}`);
  }

  refreshItem(id: string): Observable<CollectionItemResponse> {
    return this.getItem(id).pipe(tap((item) => this.changeSubject.next({ type: 'updated', item })));
  }

  lookup(
    provider: string,
    mediaType: MediaType,
    externalId: string,
  ): Observable<CollectionItemResponse | null> {
    const params = new HttpParams()
      .set('provider', provider)
      .set('mediaType', mediaType)
      .set('externalId', externalId);

    return this.http.get<CollectionItemResponse | null>(`${this.baseUrl}/lookup`, { params });
  }

  lookupBatch(
    references: ReadonlyArray<{ provider: string; mediaType: MediaType; externalId: string }>,
  ): Observable<Record<string, CollectionItemResponse>> {
    if (references.length === 0) {
      return of({});
    }
    return this.http.post<Record<string, CollectionItemResponse>>(`${this.baseUrl}/lookup-batch`, {
      references,
    });
  }

  create(request: AddToCollectionRequest): Observable<CollectionItemResponse> {
    return this.guarded(() =>
      this.http
        .post<CollectionItemResponse>(this.baseUrl, withCompletionDay(request))
        .pipe(tap((item) => this.changeSubject.next({ type: 'created', item }))),
    );
  }

  update(id: string, request: UpdateCollectionItemRequest): Observable<CollectionItemResponse> {
    return this.guarded(() =>
      this.http
        .put<CollectionItemResponse>(`${this.baseUrl}/${id}`, withCompletionDay(request))
        .pipe(
          tap((item) => {
            this.changeSubject.next({ type: 'updated', item });
            if (request.status === 'done') this.celebration.fire('done');
            else if (request.rating === 10) this.celebration.fire('rated');
          }),
        ),
    );
  }

  remove(id: string): Observable<void> {
    return this.guarded(() =>
      this.http
        .delete<void>(`${this.baseUrl}/${id}`)
        .pipe(tap(() => this.changeSubject.next({ type: 'removed', id }))),
    );
  }

  bulkUpdate(request: BulkUpdateCollectionItemRequest): Observable<CollectionItemResponse[]> {
    return this.guarded(() =>
      this.http
        .patch<CollectionItemResponse[]>(`${this.baseUrl}/bulk`, request)
        .pipe(tap((items) => this.changeSubject.next({ type: 'bulkUpdated', items }))),
    );
  }

  bulkRemove(ids: string[]): Observable<void> {
    return this.guarded(() =>
      this.http
        .post<void>(`${this.baseUrl}/bulk-delete`, { ids })
        .pipe(tap(() => this.changeSubject.next({ type: 'bulkRemoved', ids }))),
    );
  }

  clearAll(): Observable<void> {
    return this.guarded(() =>
      this.http
        .delete<void>(this.baseUrl)
        .pipe(tap(() => this.changeSubject.next({ type: 'cleared' }))),
    );
  }
}

function withCompletionDay<T extends { status?: UserMediaStatus }>(request: T): T {
  return request.status === 'done' ? { ...request, completedOn: todayIsoDate() } : request;
}
