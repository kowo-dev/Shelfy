import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PersonRowComponent } from './person-row';

describe('PersonRowComponent', () => {
  function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [PersonRowComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(PersonRowComponent);
    fixture.componentRef.setInput('displayName', 'Alice');
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the name and the line under it', () => {
    const fixture = render({ subline: 'Friends since 2020' });

    expect(fixture.nativeElement.textContent).toContain('Alice');
    expect(fixture.nativeElement.textContent).toContain('Friends since 2020');
  });

  it('is a plain block when it leads nowhere', () => {
    const fixture = render();

    expect(fixture.nativeElement.querySelector('a, button')).toBeNull();
  });

  it('links to a profile when given a route', () => {
    const fixture = render({ route: ['/users', 'alice'] });

    expect(fixture.nativeElement.querySelector('a')?.getAttribute('href')).toBe('/users/alice');
  });

  it('becomes a button that reports the click when interactive', () => {
    const fixture = render({ interactive: true });
    const activated = vi.fn();
    fixture.componentInstance.activated.subscribe(activated);

    fixture.nativeElement.querySelector('button').click();

    expect(activated).toHaveBeenCalledTimes(1);
  });

  it('prefers the link over the button when both are given', () => {
    const fixture = render({ route: '/users/alice', interactive: true });

    expect(fixture.nativeElement.querySelector('a')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
