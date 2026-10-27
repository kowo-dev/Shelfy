import { TestBed } from '@angular/core/testing';

import { SearchbarComponent } from './searchbar';

describe('SearchbarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchbarComponent],
    }).compileComponents();
  });

  it('renders the placeholder and no clear button when empty', () => {
    const fixture = TestBed.createComponent(SearchbarComponent);
    fixture.componentRef.setInput('placeholder', 'Search titles');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.placeholder).toBe('Search titles');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('updates value and calls onChange as the user types', () => {
    const fixture = TestBed.createComponent(SearchbarComponent);
    const component = fixture.componentInstance;
    const onChange = vi.fn();
    component.registerOnChange(onChange);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'batman';
    input.dispatchEvent(new Event('input'));

    expect(onChange).toHaveBeenCalledWith('batman');
    expect(component.value()).toBe('batman');
  });

  it('shows a clear button once there is a value and clears it on click', () => {
    const fixture = TestBed.createComponent(SearchbarComponent);
    const component = fixture.componentInstance;
    const onChange = vi.fn();
    component.registerOnChange(onChange);
    component.writeValue('batman');
    fixture.detectChanges();

    const clearButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(clearButton).not.toBeNull();

    const cleared = vi.fn();
    component.cleared.subscribe(cleared);
    clearButton.click();
    fixture.detectChanges();

    expect(component.value()).toBe('');
    expect(onChange).toHaveBeenCalledWith('');
    expect(cleared).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('calls onTouched on blur and emits focused on focus', () => {
    const fixture = TestBed.createComponent(SearchbarComponent);
    const component = fixture.componentInstance;
    const onTouched = vi.fn();
    const focused = vi.fn();
    component.registerOnTouched(onTouched);
    component.focused.subscribe(focused);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('blur'));

    expect(focused).toHaveBeenCalled();
    expect(onTouched).toHaveBeenCalled();
  });

  it('setDisabledState disables the input', () => {
    const fixture = TestBed.createComponent(SearchbarComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setDisabledState(true);
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).disabled).toBe(true);
  });

  it('applies overlay container classes when variant is overlay', () => {
    const fixture = TestBed.createComponent(SearchbarComponent);
    fixture.componentRef.setInput('variant', 'overlay');
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('div') as HTMLElement;
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(container.className).toContain('pb-6');
    expect(container.className).not.toContain('border-b');
    expect(input.className).toContain('font-display');
  });
});
