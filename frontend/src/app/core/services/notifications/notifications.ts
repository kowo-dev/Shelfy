import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap, type Observable } from 'rxjs';
import { environment } from '@env';
import type { PagedResponse } from '@app/core/services/collection/collection.model';
import type {
  NotificationFamily,
  NotificationPreferences,
  NotificationPreferencesUpdate,
  NotificationResponse,
  NotificationSummary,
} from './notifications.model';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/notifications`;

  private readonly changeSignal = signal(0);
  readonly changes = this.changeSignal.asReadonly();

  list(
    page = 0,
    size = 20,
    family: NotificationFamily | null = null,
  ): Observable<PagedResponse<NotificationResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (family) params = params.set('family', family);
    return this.http.get<PagedResponse<NotificationResponse>>(this.baseUrl, { params });
  }

  requests(): Observable<NotificationResponse[]> {
    return this.http.get<NotificationResponse[]>(`${this.baseUrl}/requests`);
  }

  summary(): Observable<NotificationSummary> {
    return this.http.get<NotificationSummary>(`${this.baseUrl}/summary`);
  }

  markRead(id: string): Observable<void> {
    return this.http
      .put<void>(`${this.baseUrl}/${id}/read`, {})
      .pipe(tap(() => this.changeSignal.update((v) => v + 1)));
  }

  markAllRead(): Observable<void> {
    return this.http
      .put<void>(`${this.baseUrl}/read-all`, {})
      .pipe(tap(() => this.changeSignal.update((v) => v + 1)));
  }

  clear(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(tap(() => this.changeSignal.update((v) => v + 1)));
  }

  clearAll(): Observable<void> {
    return this.http
      .delete<void>(this.baseUrl)
      .pipe(tap(() => this.changeSignal.update((v) => v + 1)));
  }

  preferences(): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>(`${this.baseUrl}/preferences`);
  }

  updatePreferences(update: NotificationPreferencesUpdate): Observable<NotificationPreferences> {
    return this.http.put<NotificationPreferences>(`${this.baseUrl}/preferences`, update);
  }
}
