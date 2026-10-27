import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import type { PersonCardFields } from '@app/core/services/people/people.model';

export interface FollowUserResponse extends PersonCardFields {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isFavorite?: boolean;
}

export interface PopularUserResponse extends FollowUserResponse {
  followersCount: number;
}

@Injectable({ providedIn: 'root' })
export class FollowsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/follows`;

  follow(userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${userId}`, {});
  }

  unfollow(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${userId}`);
  }

  following(page = 0, size = 20): Observable<PagedResponse<FollowUserResponse>> {
    return this.http.get<PagedResponse<FollowUserResponse>>(`${this.baseUrl}/following`, {
      params: { page, size },
    });
  }

  favorites(page = 0, size = 20): Observable<PagedResponse<FollowUserResponse>> {
    return this.http.get<PagedResponse<FollowUserResponse>>(`${this.baseUrl}/favorites`, {
      params: { page, size },
    });
  }

  favorite(userId: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${userId}/favorite`, {});
  }

  unfavorite(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${userId}/favorite`);
  }

  followers(page = 0, size = 20, q = ''): Observable<PagedResponse<FollowUserResponse>> {
    return this.http.get<PagedResponse<FollowUserResponse>>(`${this.baseUrl}/followers`, {
      params: { page, size, ...(q ? { q } : {}) },
    });
  }

  followingOf(userId: string, page = 0, size = 20): Observable<PagedResponse<FollowUserResponse>> {
    return this.http.get<PagedResponse<FollowUserResponse>>(`${this.baseUrl}/${userId}/following`, {
      params: { page, size },
    });
  }

  followersOf(userId: string, page = 0, size = 20): Observable<PagedResponse<FollowUserResponse>> {
    return this.http.get<PagedResponse<FollowUserResponse>>(`${this.baseUrl}/${userId}/followers`, {
      params: { page, size },
    });
  }

  popular(page = 0, size = 20): Observable<PagedResponse<PopularUserResponse>> {
    return this.http.get<PagedResponse<PopularUserResponse>>(`${this.baseUrl}/popular`, {
      params: { page, size },
    });
  }
}
