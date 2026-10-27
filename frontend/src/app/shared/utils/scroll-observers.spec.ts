import { Component, type ElementRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { observeLoadMore } from './scroll-observers';

interface Observed {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  disconnected: boolean;
}

const observed: Observed[] = [];

class RecordingObserver {
  private readonly entry: Observed;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.entry = { callback, options, disconnected: false };
    observed.push(this.entry);
  }

  observe(): void {}

  disconnect(): void {
    this.entry.disconnected = true;
  }
}

const loadMore = vi.fn();

@Component({
  selector: 'shelfy-test-viewport-list',
  template: '<div #sentinel></div>',
})
class ViewportListComponent {
  readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    observeLoadMore(this.sentinel, loadMore);
  }
}

@Component({
  selector: 'shelfy-test-scroller-list',
  template: '<div #scroller><div #sentinel></div></div>',
})
class ScrollerListComponent {
  readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    observeLoadMore(this.sentinel, loadMore, this.scroller);
  }
}

describe('observeLoadMore', () => {
  const original = globalThis.IntersectionObserver;

  beforeEach(() => {
    observed.length = 0;
    loadMore.mockReset();
    globalThis.IntersectionObserver = RecordingObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = original;
  });

  function intersect(entry: Observed, isIntersecting: boolean): void {
    entry.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      entry as unknown as IntersectionObserver,
    );
  }

  it('watches the sentinel against the viewport and loads more once it comes near', async () => {
    const fixture = TestBed.createComponent(ViewportListComponent);
    await fixture.whenStable();

    expect(observed).toHaveLength(1);
    expect(observed[0].options?.root).toBeNull();
    intersect(observed[0], false);
    expect(loadMore).not.toHaveBeenCalled();
    intersect(observed[0], true);
    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('watches against the given scroll container instead of the viewport', async () => {
    const fixture = TestBed.createComponent(ScrollerListComponent);
    await fixture.whenStable();

    expect(observed[0].options?.root).toBe(fixture.componentInstance.scroller()?.nativeElement);
  });

  it('stops watching when the component goes away', async () => {
    const fixture = TestBed.createComponent(ViewportListComponent);
    await fixture.whenStable();

    fixture.destroy();
    expect(observed[0].disconnected).toBe(true);
  });
});
