import { Injectable } from '@angular/core';
import type { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';

const QUIET_MS = 2000;
const IDLE_TIMEOUT_MS = 2000;

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

@Injectable({ providedIn: 'root' })
export class RoutePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!route.data?.['preload'] || constrainedNetwork()) return of(null);
    return whenQuiet().pipe(switchMap(() => load()));
  }
}

function constrainedNetwork(): boolean {
  const connection = (globalThis.navigator as { connection?: NetworkInformation } | undefined)
    ?.connection;
  return !!connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '');
}

function whenQuiet(): Observable<void> {
  return new Observable<void>((subscriber) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    let observer: PerformanceObserver | undefined;
    const fire = () => {
      observer?.disconnect();
      const done = () => {
        subscriber.next();
        subscriber.complete();
      };
      if (typeof requestIdleCallback === 'function') {
        idle = requestIdleCallback(done, { timeout: IDLE_TIMEOUT_MS });
      } else {
        done();
      }
    };
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(fire, QUIET_MS);
    };
    if (typeof PerformanceObserver === 'function') {
      observer = new PerformanceObserver(restart);
      try {
        observer.observe({ type: 'resource' });
      } catch {
        observer = undefined;
      }
    }
    restart();
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  });
}
