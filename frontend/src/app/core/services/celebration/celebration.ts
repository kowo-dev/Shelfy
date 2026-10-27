import { Injectable, signal } from '@angular/core';

export type CelebrationKind = 'done' | 'rated' | 'created' | 'social';

export interface Celebration {
  id: number;
  kind: CelebrationKind;
}

@Injectable({ providedIn: 'root' })
export class CelebrationService {
  private nextId = 0;
  readonly current = signal<Celebration | null>(null);

  fire(kind: CelebrationKind): void {
    this.current.set({ id: this.nextId++, kind });
  }
}
