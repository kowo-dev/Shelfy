import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import { communityParams } from '@app/core/services/community/community';
import type { CommunityQuery } from '@app/core/services/community/community.model';
import type { EssentialEntry } from '@app/core/services/essentials/essentials.model';
import type { UserProfileResponse } from '@app/core/services/people/people.model';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import type { WatchLogEntry } from '@app/core/services/watch-log/watch-log.model';
import type { ReviewResponse, UserActivityResponse } from './user-profile.model';

@Injectable({
  providedIn: 'root',
})
export class UserProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/users`;

  getProfile(username: string): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(`${this.baseUrl}/${username}/profile`);
  }

  getEssentials(username: string): Observable<EssentialEntry[]> {
    return this.http.get<EssentialEntry[]>(`${this.baseUrl}/${username}/essentials`);
  }

  getReviews(
    username: string,
    page = 0,
    size = 20,
    q = '',
  ): Observable<PagedResponse<ReviewResponse>> {
    return this.http.get<PagedResponse<ReviewResponse>>(`${this.baseUrl}/${username}/reviews`, {
      params: { page, size, ...(q ? { q } : {}) },
    });
  }

  browseReviews(
    page = 0,
    size = 20,
    query: CommunityQuery = {},
  ): Observable<PagedResponse<ReviewResponse>> {
    return this.http.get<PagedResponse<ReviewResponse>>(`${this.baseUrl}/reviews`, {
      params: communityParams(page, size, query),
    });
  }

  getReview(id: string): Observable<ReviewResponse> {
    return this.http.get<ReviewResponse>(`${this.baseUrl}/reviews/${id}`);
  }

  getReviewWatchLog(id: string): Observable<WatchLogEntry[]> {
    return this.http.get<WatchLogEntry[]>(`${this.baseUrl}/reviews/${id}/watch-log`);
  }

  likeReview(id: string): Observable<ReviewResponse> {
    return this.http.post<ReviewResponse>(`${this.baseUrl}/reviews/${id}/likes`, {});
  }

  unlikeReview(id: string): Observable<ReviewResponse> {
    return this.http.delete<ReviewResponse>(`${this.baseUrl}/reviews/${id}/likes`);
  }

  getMediaReviews(
    provider: string,
    mediaType: string,
    externalId: string,
  ): Observable<ReviewResponse[]> {
    return this.http.get<ReviewResponse[]>(`${this.baseUrl}/reviews/media`, {
      params: { provider, mediaType, externalId },
    });
  }

  getActivity(
    username: string,
    page = 0,
    size = 12,
  ): Observable<PagedResponse<UserActivityResponse>> {
    return this.http.get<PagedResponse<UserActivityResponse>>(
      `${this.baseUrl}/${username}/activity`,
      { params: { page, size } },
    );
  }
}
