import { inject, Injectable, signal } from '@angular/core';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';

const VOLUME_KEY = 'shelfy.clips.volume';
const MUTED_KEY = 'shelfy.clips.muted';
const DEFAULT_VOLUME = 40;

@Injectable({ providedIn: 'root' })
export class ClipPlaybackService {
  private readonly storage = inject(LocalStorageService);

  readonly active = signal<string | null>(null);
  readonly volume = signal(this.readVolume());
  readonly muted = signal(this.storage.getItem(MUTED_KEY) === 'true');
  readonly soundAllowed = signal(
    (globalThis.navigator as { userActivation?: { hasBeenActive: boolean } } | undefined)
      ?.userActivation?.hasBeenActive ?? false,
  );

  constructor() {
    if (this.soundAllowed()) return;
    const allow = () => this.allowSound();
    for (const type of ['pointerdown', 'keydown'] as const) {
      globalThis.document?.addEventListener(type, allow, { capture: true, once: true });
    }
  }

  allowSound(): void {
    this.soundAllowed.set(true);
  }

  toggle(key: string): void {
    this.active.update((current) => (current === key ? null : key));
  }

  play(key: string): void {
    this.active.set(key);
  }

  stop(key: string): void {
    if (this.active() === key) this.active.set(null);
  }

  setVolume(volume: number): void {
    const value = Math.max(0, Math.min(100, Math.round(volume)));
    this.volume.set(value);
    this.storage.setItem(VOLUME_KEY, String(value));
  }

  setMuted(muted: boolean): void {
    this.muted.set(muted);
    this.storage.setItem(MUTED_KEY, String(muted));
  }

  private readVolume(): number {
    const stored = Number(this.storage.getItem(VOLUME_KEY));
    return this.storage.getItem(VOLUME_KEY) !== null && Number.isFinite(stored)
      ? Math.max(0, Math.min(100, stored))
      : DEFAULT_VOLUME;
  }
}
