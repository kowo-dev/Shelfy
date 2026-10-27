import { Injectable, signal } from '@angular/core';
import type { CollectTitle } from './collect.model';

export type CollectCloseReason = 'done' | 'cancelled' | 'dismissed' | 'navigated';

@Injectable({ providedIn: 'root' })
export class CollectSheetService {
  readonly titles = signal<readonly CollectTitle[] | null>(null);
  private waiting: ((reason: CollectCloseReason) => void)[] = [];

  open(titles: readonly CollectTitle[]): void {
    if (titles.length > 0) this.titles.set(titles);
  }

  whenClosed(): Promise<CollectCloseReason> {
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  close(reason: CollectCloseReason = 'dismissed'): void {
    this.titles.set(null);
    this.waiting.splice(0).forEach((resolve) => resolve(reason));
  }
}
