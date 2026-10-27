import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';

import { RatingRangeComponent } from './rating-range';

describe('RatingRangeComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
  });

  function create(from: number, to: number) {
    const fixture = TestBed.createComponent(RatingRangeComponent);
    fixture.componentRef.setInput('label', 'Your rating');
    fixture.componentRef.setInput('from', from);
    fixture.componentRef.setInput('to', to);
    fixture.detectChanges();
    const [low, high] = (fixture.nativeElement as HTMLElement).querySelectorAll('input');
    return { fixture, low, high };
  }

  function drag(input: HTMLInputElement, value: number) {
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
  }

  it('shows the range in half stars', () => {
    const { fixture } = create(3, 10);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1.5 – 5');
  });

  it('emits once the thumb is released, never crossing the other thumb', () => {
    const { fixture, low, high } = create(3, 6);
    const emitted: { from: number; to: number }[] = [];
    fixture.componentInstance.changed.subscribe((value) => emitted.push(value));

    drag(low, 8);
    drag(high, 9);

    expect(emitted).toEqual([
      { from: 6, to: 6 },
      { from: 6, to: 9 },
    ]);
  });
});
