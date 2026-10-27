import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, shareReplay, switchMap, type Observable } from 'rxjs';
import { environment } from '@env';
import type { LegalInfo } from './legal.model';

@Injectable({ providedIn: 'root' })
export class LegalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/legal`;
  private readonly info$ = this.http
    .get<LegalInfo>(`${this.baseUrl}/info`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  readonly registrationOpen$ = this.info$.pipe(
    map((info) => info.isRegistrationOpen !== false),
    catchError(() => of(true)),
  );

  getInfo(): Observable<LegalInfo> {
    return this.info$;
  }
}

export function injectRegistrationOpen(when: Signal<boolean> = signal(true)): Signal<boolean> {
  const legal = inject(LegalService);
  return toSignal(
    toObservable(when).pipe(switchMap((active) => (active ? legal.registrationOpen$ : of(true)))),
    { initialValue: true },
  );
}
