import { TestBed } from '@angular/core/testing';

import { ToggleComponent } from './toggle';

describe('ToggleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToggleComponent],
    }).compileComponents();
  });

  it('renders unchecked by default', () => {
    const fixture = TestBed.createComponent(ToggleComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(false);
  });

  it('reflects the checked input', () => {
    const fixture = TestBed.createComponent(ToggleComponent);
    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  it('emits checkedChange with the new value when toggled', () => {
    const fixture = TestBed.createComponent(ToggleComponent);
    fixture.detectChanges();

    const emitted: boolean[] = [];
    fixture.componentInstance.checkedChange.subscribe((v) => emitted.push(v));

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([true]);
  });

  it('disables the input and applies disabled styling', () => {
    const fixture = TestBed.createComponent(ToggleComponent);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(input.disabled).toBe(true);
    expect(label.classList.contains('opacity-50')).toBe(true);
    expect(label.classList.contains('cursor-not-allowed')).toBe(true);
  });

  it('assigns a unique id shared between the input and label', () => {
    const fixture = TestBed.createComponent(ToggleComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(input.id).toBeTruthy();
    expect(label.getAttribute('for')).toBe(input.id);
  });
});
