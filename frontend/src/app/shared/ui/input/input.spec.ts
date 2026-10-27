import { TestBed } from '@angular/core/testing';

import { InputComponent } from './input';

describe('InputComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputComponent],
    }).compileComponents();
  });

  it('renders the label and hint when provided', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('label', 'Email');
    fixture.componentRef.setInput('hint', 'We will never share it');
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.textContent).toContain('Email');
    expect(fixture.nativeElement.querySelector('.form-hint')?.textContent).toContain(
      'We will never share it',
    );
  });

  it('shows the error message instead of the hint when both are set', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('hint', 'hint text');
    fixture.componentRef.setInput('error', 'Required field');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.form-error')?.textContent).toContain(
      'Required field',
    );
    expect(fixture.nativeElement.querySelector('.form-hint')).toBeNull();
  });

  it('reflects typed input through the ControlValueAccessor onChange callback', () => {
    const fixture = TestBed.createComponent(InputComponent);
    const component = fixture.componentInstance;
    const onChange = vi.fn();
    component.registerOnChange(onChange);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));

    expect(onChange).toHaveBeenCalledWith('hello');
    expect(component.value()).toBe('hello');
  });

  it('calls onTouched on blur', () => {
    const fixture = TestBed.createComponent(InputComponent);
    const component = fixture.componentInstance;
    const onTouched = vi.fn();
    component.registerOnTouched(onTouched);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('blur'));

    expect(onTouched).toHaveBeenCalled();
  });

  it('writeValue updates the rendered value, including null', () => {
    const fixture = TestBed.createComponent(InputComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.writeValue('preset');
    expect(component.value()).toBe('preset');

    component.writeValue(null);
    expect(component.value()).toBe('');
  });

  it('setDisabledState disables the input element', () => {
    const fixture = TestBed.createComponent(InputComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setDisabledState(true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('toggles password visibility when passwordToggle is enabled', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('type', 'password');
    fixture.componentRef.setInput('passwordToggle', true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');

    const toggleButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    toggleButton.click();
    fixture.detectChanges();

    expect(input.type).toBe('text');
  });
});
