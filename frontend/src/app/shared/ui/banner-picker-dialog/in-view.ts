import { DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';

@Directive({
  selector: '[shelfyInView]',
  standalone: true,
})
export class InViewDirective {
  inView = output<void>();

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    if (typeof IntersectionObserver === 'undefined') {
      queueMicrotask(() => this.inView.emit());
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        this.inView.emit();
      }
    });
    observer.observe(el);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
