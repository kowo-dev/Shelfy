import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';

import { RatingSliderComponent } from './rating-slider';

describe('RatingSliderComponent', () => {
  function create(value: number | null) {
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(RatingSliderComponent);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    const emitted: (number | null)[] = [];
    fixture.componentInstance.changed.subscribe((v) => emitted.push(v));
    return { fixture, slider: fixture.componentInstance, emitted };
  }

  const rect = { left: 100, width: 300 };

  it('maps a pointer position to a half-star step, clamped to the row', () => {
    const { slider } = create(null);

    expect(slider.stepAt(101, rect)).toBe(1);
    expect(slider.stepAt(100 + 150, rect)).toBe(5);
    expect(slider.stepAt(100 + 151, rect)).toBe(6);
    expect(slider.stepAt(400, rect)).toBe(10);
    expect(slider.stepAt(20, rect)).toBe(1);
    expect(slider.stepAt(900, rect)).toBe(10);
  });

  it('fills whole and half stars from the value', () => {
    const { slider } = create(7);

    expect([1, 2, 3, 4, 5].map((star) => slider.starFill(star))).toEqual([100, 100, 100, 50, 0]);
  });

  it('clears the rating when the current value is tapped again, but not after a drag', () => {
    const { fixture, slider, emitted } = create(6);
    const track = fixture.nativeElement.querySelector('[role=slider]') as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 100, width: 300 }) as DOMRect;

    slider.onDown({ clientX: 280, pointerId: 1 } as PointerEvent);
    slider.onUp();
    expect(emitted).toEqual([null]);

    slider.onDown({ clientX: 200, pointerId: 1 } as PointerEvent);
    slider.onMove({ clientX: 280, pointerType: 'touch' } as PointerEvent);
    slider.onUp();
    expect(emitted).toEqual([null, 6]);
  });

  it('steps with the keyboard and clears with Delete', () => {
    const { slider } = create(4);

    expect(slider.keyTarget('ArrowRight')).toBe(5);
    expect(slider.keyTarget('ArrowLeft')).toBe(3);
    expect(slider.keyTarget('Home')).toBe(1);
    expect(slider.keyTarget('End')).toBe(10);
    expect(slider.keyTarget('Delete')).toBeNull();
    expect(slider.keyTarget('a')).toBeUndefined();
  });

  it('exposes the value as a slider for assistive tech', () => {
    const { fixture } = create(9);
    const track = fixture.nativeElement.querySelector('[role=slider]') as HTMLElement;

    expect(track.getAttribute('aria-valuenow')).toBe('9');
    expect(track.getAttribute('aria-valuemax')).toBe('10');
  });
});
