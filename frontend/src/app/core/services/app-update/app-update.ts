import { DestroyRef, inject, Injectable } from '@angular/core';
import { GuardsCheckEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter, type Subscription } from 'rxjs';

export const STARTUP_CHECK_MS = 2500;
const ACTIVATE_MS = 1000;

function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly router = inject(Router);
  private pending = false;
  private versions: Subscription | null = null;

  private get controlled(): boolean {
    return !!globalThis.navigator?.serviceWorker?.controller;
  }

  async checkAtStartup(timeoutMs = STARTUP_CHECK_MS): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    this.listen();
    if (!this.controlled) return;
    await within(this.swUpdate.checkForUpdate(), timeoutMs, false);
    if (await within(this.swUpdate.activateUpdate(), ACTIVATE_MS, false)) {
      this.reload();
      await new Promise<never>(() => undefined);
    }
  }

  watch(destroyRef: DestroyRef): void {
    if (!this.swUpdate.isEnabled) return;
    this.listen();

    const navigations = this.router.events
      .pipe(
        filter(
          (event): event is GuardsCheckEnd =>
            event instanceof GuardsCheckEnd && event.shouldActivate && this.pending,
        ),
      )
      .subscribe((event) => void this.applyOn(event.urlAfterRedirects));

    const checkOnResume = () => {
      if (document.visibilityState === 'visible') {
        void this.swUpdate.checkForUpdate().catch(() => false);
      }
    };
    document.addEventListener('visibilitychange', checkOnResume);

    destroyRef.onDestroy(() => {
      this.versions?.unsubscribe();
      this.versions = null;
      navigations.unsubscribe();
      document.removeEventListener('visibilitychange', checkOnResume);
    });
  }

  private listen(): void {
    if (this.versions) return;
    this.versions = this.swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') this.pending = true;
    });
    this.versions.add(this.swUpdate.unrecoverable.subscribe(() => this.reload()));
  }

  private async applyOn(url: string): Promise<void> {
    this.pending = false;
    await within(this.swUpdate.activateUpdate(), ACTIVATE_MS, false);
    this.navigate(url);
  }

  protected reload(): void {
    document.location.reload();
  }

  protected navigate(url: string): void {
    document.location.assign(url);
  }
}
