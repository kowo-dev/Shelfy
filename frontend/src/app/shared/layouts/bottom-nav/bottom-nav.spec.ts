import { Subject } from 'rxjs';

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationCancel, NavigationEnd, Router } from '@angular/router';

import { BottomNavComponent } from './bottom-nav';

describe('BottomNavComponent', () => {
  let routerEvents: Subject<unknown>;
  let router: { url: string; events: Subject<unknown>; navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    routerEvents = new Subject();
    router = { url: '/discover', events: routerEvents, navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [
        {
          provide: Router,
          useValue: router,
        },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();
  });

  it('reflects the initial router url on creation', () => {
    const component = TestBed.createComponent(BottomNavComponent).componentInstance;
    expect(component.isActive('/discover')).toBe(true);
    expect(component.isActive('/collection')).toBe(false);
  });

  it('updates the active route when a NavigationEnd event fires', () => {
    const component = TestBed.createComponent(BottomNavComponent).componentInstance;

    router.url = '/collection';
    routerEvents.next(new NavigationEnd(1, '/collection', '/collection'));

    expect(component.isActive('/collection')).toBe(true);
    expect(component.isActive('/discover')).toBe(false);
  });

  it('falls back to the real url when a tapped tab navigation is cancelled', () => {
    const component = TestBed.createComponent(BottomNavComponent).componentInstance;
    router.url = '/creations';
    routerEvents.next(new NavigationEnd(1, '/creations', '/creations'));

    component.onTab('/discover');
    expect(component.isActive('/discover')).toBe(true);
    routerEvents.next(new NavigationCancel(2, '/discover', 'guard'));

    expect(component.isActive('/discover')).toBe(false);
  });

  it('does not light a tab for a lookalike path', () => {
    router.url = '/discoverers';
    const component = TestBed.createComponent(BottomNavComponent).componentInstance;
    expect(component.isActive('/discover')).toBe(false);
  });

  it('ignores router events that do not settle a navigation', () => {
    const component = TestBed.createComponent(BottomNavComponent).componentInstance;

    routerEvents.next({ id: 1 });

    expect(component.isActive('/discover')).toBe(true);
  });

  it('sends the centre button to Explore', () => {
    const component = TestBed.createComponent(BottomNavComponent).componentInstance;

    component.quickAdd();

    expect(router.navigate).toHaveBeenCalledWith(['/explore']);
  });
});
