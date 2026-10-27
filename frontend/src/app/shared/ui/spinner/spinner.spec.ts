import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { SpinnerComponent } from './spinner';

describe('SpinnerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpinnerComponent],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  it('renders a status role element with the medium size by default', () => {
    const fixture = TestBed.createComponent(SpinnerComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.className).toContain('size-4');
    expect(el.getAttribute('aria-label')).toBe('shared.loading');
  });

  it('applies the small size class', () => {
    const fixture = TestBed.createComponent(SpinnerComponent);
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(el.className).toContain('size-3.5');
  });

  it('applies the large size class', () => {
    const fixture = TestBed.createComponent(SpinnerComponent);
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(el.className).toContain('size-5');
  });
});
