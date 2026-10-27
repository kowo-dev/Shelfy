import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';
import { StarRatingComponent } from './star-rating';

describe('StarRatingComponent', () => {
  function setup(value: number | null, toggle = false) {
    TestBed.configureTestingModule({
      imports: [StarRatingComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(StarRatingComponent);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('toggle', toggle);
    fixture.detectChanges();
    return fixture;
  }

  const halves = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('[role=radio]')];

  it('renders a radiogroup of five stars with a half step each', () => {
    const el: HTMLElement = setup(null).nativeElement;

    expect(el.querySelector('[role=radiogroup]')).not.toBeNull();
    expect(halves(el)).toHaveLength(10);
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

  it('only clears on the current score when toggle is on', () => {
    const emitted: (number | null)[] = [];
    const plain = setup(5);
    plain.componentInstance.changed.subscribe((v) => emitted.push(v));
    plain.componentInstance.pick(5);
    expect(emitted).toEqual([5]);

    TestBed.resetTestingModule();
    const toggling = setup(5, true);
    toggling.componentInstance.changed.subscribe((v) => emitted.push(v));
    toggling.componentInstance.pick(5);
    expect(emitted).toEqual([5, null]);
  });

  it('fills whole stars, then a half star, from the shown score', () => {
    const component = setup(7).componentInstance;
    const fills = () => [1, 2, 3, 4, 5].map((star) => component.starFill(star));

    expect(fills()).toEqual([100, 100, 100, 50, 0]);
    component.previewRating.set(10);
    expect(fills()).toEqual([100, 100, 100, 100, 100]);
    component.previewRating.set(1);
    expect(fills()).toEqual([50, 0, 0, 0, 0]);
  });

  it('previews a half step on hover and focus, tells the parent, and clears it on blur', () => {
    const fixture = setup(null);
    const previews: (number | null)[] = [];
    fixture.componentInstance.previewed.subscribe((v) => previews.push(v));
    const target = halves(fixture.nativeElement)[4];

    target.dispatchEvent(new Event('mouseenter'));
    expect(fixture.componentInstance.shownRating()).toBe(5);
    target.dispatchEvent(new Event('blur'));
    expect(fixture.componentInstance.shownRating()).toBeNull();
    expect(previews).toEqual([5, null]);
  });

  it.each([
    [3, 'ArrowRight', 4],
    [3, 'ArrowDown', 4],
    [3, 'ArrowLeft', 2],
    [3, 'ArrowUp', 2],
    [10, 'ArrowRight', 1],
    [1, 'ArrowLeft', 10],
    [6, 'Home', 1],
    [6, 'End', 10],
    [6, 'Tab', null],
  ])('moves from half step %i with %s to %s', (from, key, expected) => {
    expect(setup(null).componentInstance.targetStep(from, key)).toBe(expected);
  });

  it('moves focus by one half step with the arrow keys', () => {
    const fixture = setup(6);
    const targets = halves(fixture.nativeElement);
    targets[5].focus();

    targets[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(targets[6]);

    targets[6].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(targets[9]);
    targets[9].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(targets[0]);
  });

  it('keeps the checked half step in the tab order and labels each half', () => {
    const targets = halves(setup(7).nativeElement);

    expect(targets.map((t) => t.tabIndex)).toEqual([-1, -1, -1, -1, -1, -1, 0, -1, -1, -1]);
    expect(targets[6].getAttribute('aria-checked')).toBe('true');
    expect(targets[0].getAttribute('aria-label')).toBe('collection.sheet.rating_step');
  });

  it('sizes the stars from the size input', () => {
    const fixture = setup(null);
    expect(fixture.nativeElement.querySelector('shelfy-icon').classList).toContain('size-11');

    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('shelfy-icon').classList).toContain('size-5');
  });
});
