import { TestBed } from '@angular/core/testing';

import { SelectComponent, type SelectOption } from './select';

const OPTIONS: SelectOption[] = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
];

describe('SelectComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectComponent],
    }).compileComponents();
  });

  function setup(options: SelectOption[] = OPTIONS) {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('options', options);
    fixture.detectChanges();
    return fixture;
  }

  it('renders no selected label when nothing is selected yet', () => {
    const fixture = setup();
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(trigger.textContent?.trim()).toBe('');
  });

  it('toggles the option list open and closed on trigger click', () => {
    const fixture = setup();
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(1);

    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(1 + OPTIONS.length);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(1);
  });

  it('selects an option, updates the label and calls onChange', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const onChange = vi.fn();
    component.registerOnChange(onChange);

    component.toggleOpen();
    fixture.detectChanges();

    const optionButtons = fixture.nativeElement.querySelectorAll('button');
    (optionButtons[2] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(onChange).toHaveBeenCalledWith('b');
    expect(component.value()).toBe('b');
    expect(component.open()).toBe(false);
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(trigger.textContent).toContain('Option B');
  });

  it('does not open when disabled', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    component.setDisabledState(true);
    fixture.detectChanges();

    component.toggleOpen();
    fixture.detectChanges();

    expect(component.open()).toBe(false);
  });

  it('closes and calls onTouched when Escape is pressed', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const onTouched = vi.fn();
    component.registerOnTouched(onTouched);
    component.toggleOpen();
    fixture.detectChanges();
    expect(component.open()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.open()).toBe(false);
    expect(onTouched).toHaveBeenCalled();
  });

  it('closes when clicking outside the component', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    component.toggleOpen();
    fixture.detectChanges();
    expect(component.open()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.open()).toBe(false);
  });

  it('writeValue reflects an externally set value, including null', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    component.writeValue('a');
    expect(component.value()).toBe('a');
    expect(component.selectedLabel()).toBe('Option A');

    component.writeValue(null);
    expect(component.value()).toBe('');
  });

  it('renders the error message instead of the hint when both are set', () => {
    const fixture = setup();
    fixture.componentRef.setInput('hint', 'pick one');
    fixture.componentRef.setInput('error', 'required');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.form-error')?.textContent).toContain('required');
    expect(fixture.nativeElement.querySelector('.form-hint')).toBeNull();
  });

  it('renders the bare variant without a form-field wrapper', () => {
    const fixture = setup();
    fixture.componentRef.setInput('variant', 'bare');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.form-field')).toBeNull();
  });
});
