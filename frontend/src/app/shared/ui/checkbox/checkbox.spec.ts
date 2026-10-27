import { TestBed } from '@angular/core/testing';

import { CheckboxComponent } from './checkbox';

describe('CheckboxComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckboxComponent],
    }).compileComponents();
  });

  it('renders unchecked by default and reflects the checked input when unbound to a form', () => {
    const fixture = TestBed.createComponent(CheckboxComponent);
    fixture.detectChanges();

    let input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(false);

    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();

    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(true);
    expect(fixture.nativeElement.querySelector('shelfy-icon')).not.toBeNull();
  });

  it('emits checkedChange and reverts the checkbox back to the input-driven value when not bound to a form', () => {
    const fixture = TestBed.createComponent(CheckboxComponent);
    fixture.detectChanges();

    const emitted: boolean[] = [];
    fixture.componentInstance.checkedChange.subscribe((v) => emitted.push(v));

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([true]);
    expect(input.checked).toBe(false);
  });

  it('acts as a ControlValueAccessor when bound to a form', () => {
    const fixture = TestBed.createComponent(CheckboxComponent);
    const component = fixture.componentInstance;
    const onChange = vi.fn();
    const onTouched = vi.fn();
    component.registerOnChange(onChange);
    component.registerOnTouched(onTouched);
    component.writeValue(true);
    fixture.detectChanges();

    let input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(true);

    input.checked = false;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(onChange).toHaveBeenCalledWith(false);
    expect(onTouched).toHaveBeenCalled();
    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(false);
  });

  it('writeValue defaults a null value to false', () => {
    const fixture = TestBed.createComponent(CheckboxComponent);
    const component = fixture.componentInstance;
    component.registerOnChange(() => {});
    component.writeValue(null);
    fixture.detectChanges();

    expect(component.isChecked).toBe(false);
  });

  it('setDisabledState disables the input and applies disabled styling', () => {
    const fixture = TestBed.createComponent(CheckboxComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setDisabledState(true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    const span = fixture.nativeElement.querySelector('span') as HTMLSpanElement;
    expect(span.classList.contains('opacity-50')).toBe(true);
  });
});
