import { TestBed } from '@angular/core/testing';

import { RatingRingComponent } from './rating-ring';

describe('RatingRingComponent', () => {
  function create(rating: number) {
    const fixture = TestBed.createComponent(RatingRingComponent);
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the value and fills the ring proportionally', () => {
    const circumference = 2 * Math.PI * 17;
    const filled = (el: HTMLElement) =>
      Number(el.querySelectorAll('circle')[1].getAttribute('stroke-dasharray')?.split(' ')[0]);

    expect(filled(create(0))).toBe(0);
    expect(filled(create(10))).toBeCloseTo(circumference);
    expect(filled(create(7.5))).toBeCloseTo(circumference * 0.75);
    expect(create(7.5).textContent).toContain('3.8');
    expect(create(8).textContent).toContain('4');
    expect(create(8).getAttribute('aria-label')).toBe('4/5');
  });
});
