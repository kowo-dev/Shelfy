import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '@env';
import type { EssentialEntry } from './essentials.model';

@Injectable({ providedIn: 'root' })
export class EssentialsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/essentials`;

  replace(userMediaIds: readonly string[]): Observable<EssentialEntry[]> {
    return this.http.put<EssentialEntry[]>(this.baseUrl, { userMediaIds });
  }
}
