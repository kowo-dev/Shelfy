import { Injectable, signal } from '@angular/core';

export const NAV_OVERLAY = { navOverlay: true } as const;

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly navOverlay = signal(false);
  readonly immersive = signal(false);
  readonly navSolidAt = signal(0);
  readonly scrollTop = signal(0);
}
