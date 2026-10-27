import { TestBed } from '@angular/core/testing';
import { RatingValueComponent } from './rating-value';

describe('RatingValueComponent', () => {
  function create(inputs: Record<string, unknown>): HTMLElement {
    const fixture = TestBed.createComponent(RatingValueComponent);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('shows a star before the value on five and the source label after it', () => {
    const el = create({ value: 9, color: 'red', label: 'TMDB' });
    const mark = el.querySelector<HTMLElement>('span[style]')!;
    expect(mark.querySelector('shelfy-icon')).not.toBeNull();
    expect(mark.textContent!.trim()).toBe('4.5');
    expect(mark.style.color).toBe('red');
    expect(el.textContent).toContain('TMDB');
  });

  it('leaves out the label when there is none', () => {
    const el = create({ value: 7 });
    expect(el.textContent!.trim()).toBe('3.5');
    expect(el.querySelector('.uppercase')).toBeNull();
  });
});
