import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

export const FOCUSABLE =
  'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

export function trapTab(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
  if (items.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const outside = active === container || !container.contains(active);
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}

@Directive({
  selector: '[shelfyFocusTrap]',
  standalone: true,
  host: { '(keydown)': 'onKeydown($event)' },
})
export class FocusTrapDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly opener = document.activeElement as HTMLElement | null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.opener?.focus?.());
  }

  onKeydown(event: KeyboardEvent): void {
    trapTab(event, this.host);
  }
}
