import { afterRenderEffect, type ElementRef } from '@angular/core';

type Ref = () => ElementRef<HTMLElement> | undefined;

export function observeLoadMore(sentinel: Ref, loadMore: () => void, root?: Ref): void {
  afterRenderEffect((onCleanup) => {
    const element = sentinel()?.nativeElement;
    if (!element) return;
    const rootElement = root?.()?.nativeElement ?? null;
    const reach = (rootElement?.clientHeight ?? globalThis.innerHeight) * 1.5;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root: rootElement, rootMargin: `0px 0px ${Math.round(reach)}px 0px` },
    );
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  });
}
