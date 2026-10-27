import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class SearchFocusService {
  private readonly router = inject(Router);
  readonly pending = signal(false);

  open(): void {
    this.pending.set(true);
    this.holdKeyboard();
    void this.router.navigate(['/explore']);
  }

  private holdKeyboard(): void {
    if (typeof document === 'undefined') return;
    const proxy = document.createElement('input');
    proxy.tabIndex = -1;
    proxy.setAttribute('aria-hidden', 'true');
    proxy.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
    document.body.appendChild(proxy);
    proxy.addEventListener('blur', () => proxy.remove(), { once: true });
    proxy.focus({ preventScroll: true });
    setTimeout(() => proxy.remove(), 3000);
  }
}
