import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';
import { RatingPickerComponent } from './rating-picker';

describe('RatingPickerComponent', () => {
  function setup(value: number | null, toggle = false) {
    TestBed.configureTestingModule({
      imports: [RatingPickerComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(RatingPickerComponent);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('toggle', toggle);
    fixture.detectChanges();
    return fixture;
  }

  function create(value: number | null, toggle = false) {
    return setup(value, toggle).componentInstance;
  }

  const halves = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('[role=radio]')];

  it('shrinks the number inside the ring only for half values', () => {
    const component = create(null);

    expect(component.numberClass(10)).not.toContain('text-[2.25rem]');
    expect(component.numberClass(9)).toContain('text-[2.25rem]');
    expect(component.numberClass(1)).toContain('text-[2.25rem]');
    expect(component.numberClass(null)).toBe('text-text-subtle');
  });

  it('previews a hovered score without emitting', () => {
    const component = create(4);
    const emitted: (number | null)[] = [];
    component.changed.subscribe((v) => emitted.push(v));

    component.previewRating.set(9);
    expect(component.shownRating()).toBe(9);
    expect(component.verdictKey()).toBe('collection.verdict.amazing');
    expect(emitted).toEqual([]);

    component.previewRating.set(null);
    expect(component.shownRating()).toBe(4);
  });

  it('only clears on the current score when toggle is on', () => {
    const emitted: (number | null)[] = [];
    const plain = setup(5);
    plain.componentInstance.changed.subscribe((v) => emitted.push(v));
    halves(plain.nativeElement)[4].click();
    expect(emitted).toEqual([5]);

    TestBed.resetTestingModule();
    const toggling = setup(5, true);
    toggling.componentInstance.changed.subscribe((v) => emitted.push(v));
    halves(toggling.nativeElement)[4].click();
    expect(emitted).toEqual([5, null]);
  });

  it('renders five stars with a half and a full target each', () => {
    const el: HTMLElement = setup(null).nativeElement;
    const targets = halves(el);

    expect(targets).toHaveLength(10);
    expect(targets.map((t) => t.getAttribute('aria-label'))).toEqual(
      Array.from({ length: 10 }, () => 'collection.sheet.rating_step'),
    );
  });

  it('sets an odd score from a left half and an even score from a right half', () => {
    const fixture = setup(null);
    const emitted: (number | null)[] = [];
    fixture.componentInstance.changed.subscribe((v) => emitted.push(v));
    const targets = halves(fixture.nativeElement);

    targets[6].click();
    targets[7].click();
    targets[0].click();
    targets[9].click();

    expect(emitted).toEqual([7, 8, 1, 10]);
  });

  it('shows the score out of five next to a ring filled out of ten', () => {
    const fixture = setup(7);
    const el: HTMLElement = fixture.nativeElement;
    const circumference = 2 * Math.PI * 33;
    const arc = el.querySelectorAll('circle')[1].getAttribute('stroke-dasharray')!;

    expect(el.querySelector('b')?.textContent?.trim()).toBe('3.5');
    expect(Number(arc.split(' ')[0])).toBeCloseTo(circumference * 0.7);
  });

  it('previews a half step on hover and focus and clears it on blur', () => {
    const fixture = setup(null);
    const target = halves(fixture.nativeElement)[4];

    target.dispatchEvent(new Event('mouseenter'));
    expect(fixture.componentInstance.shownRating()).toBe(5);
    target.dispatchEvent(new Event('blur'));
    expect(fixture.componentInstance.shownRating()).toBeNull();
  });

  it('moves focus by one half step with the arrow keys', () => {
    const fixture = setup(6);
    const targets = halves(fixture.nativeElement);
    targets[5].focus();

    targets[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(targets[6]);
    expect(fixture.componentInstance.shownRating()).toBe(7);

    targets[6].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(targets[9]);
    targets[9].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(targets[0]);
  });

  it('keeps the checked half step in the tab order', () => {
    const targets = halves(setup(7).nativeElement);

    expect(targets.map((t) => t.tabIndex)).toEqual([-1, -1, -1, -1, -1, -1, 0, -1, -1, -1]);
    expect(targets[6].getAttribute('aria-checked')).toBe('true');
  });

  it('clears the rating from the remove link', () => {
    const fixture = setup(6);
    const emitted: (number | null)[] = [];
    fixture.componentInstance.changed.subscribe((v) => emitted.push(v));

    fixture.nativeElement.querySelector('button:not([role=radio])').click();

    expect(emitted).toEqual([null]);
  });
});
