import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@app/core/services/auth/auth';
import { NotFoundPageComponent } from './not-found';

describe('NotFoundPageComponent', () => {
  function render(authenticated: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: signal(authenticated) } },
      ],
    });
    const fixture = TestBed.createComponent(NotFoundPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sends guests back to discover', () => {
    expect(render(false).querySelector('a')?.getAttribute('href')).toBe('/discover');
  });

  it('sends signed-in users back to their shelf and needs no network', () => {
    const el = render(true);

    expect(el.querySelector('a')?.getAttribute('href')).toBe('/collection');
    expect(el.querySelectorAll('img')).toHaveLength(0);
  });
});
