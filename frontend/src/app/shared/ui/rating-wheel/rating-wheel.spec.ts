import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RatingWheelComponent } from './rating-wheel';

describe('RatingWheelComponent', () => {
  function setup(value: number | null) {
    const fixture = TestBed.createComponent(RatingWheelComponent);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return fixture;
  }

  it('centres the current rating, with a dash for no rating', () => {
    const rated = setup(7);
    expect(rated.componentInstance.current()).toBe(7);
    expect(rated.componentInstance.text(7)).toBe('3.5');

    const unrated = setup(null);
    expect(unrated.componentInstance.current()).toBe(0);
    expect((unrated.nativeElement as HTMLElement).textContent).toContain('–');
  });

  it('commits the step it settles on after scrolling, and clears at the dash', () => {
    vi.useFakeTimers();
    const fixture = setup(4);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    const track = (fixture.nativeElement as HTMLElement).querySelector('[role="slider"]')!;
    Object.defineProperty(track.firstElementChild, 'clientWidth', { value: 50 });

    track.scrollLeft = 150;
    fixture.componentInstance.onScroll();
    vi.advanceTimersByTime(200);
    expect(changed).toHaveBeenLastCalledWith(3);

    track.scrollLeft = 0;
    fixture.componentInstance.onScroll();
    vi.advanceTimersByTime(200);
    expect(changed).toHaveBeenLastCalledWith(null);
    vi.useRealTimers();
  });
});
