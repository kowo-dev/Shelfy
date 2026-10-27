import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, RouteReuseStrategy, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LayoutService } from '@app/core/services/layout/layout';

import { PageCacheStrategy } from './page-cache-strategy';

let created = 0;

@Component({
  selector: 'shelfy-test-shell',
  template: '<router-outlet />',
  imports: [RouterOutlet],
})
class ShellComponent {}

@Component({ selector: 'shelfy-test-page', template: 'page' })
class PageComponent {
  readonly id = ++created;
}

@Component({ selector: 'shelfy-test-form', template: 'form' })
class FormComponent {}

describe('PageCacheStrategy', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  }

  function pageId(): number {
    return harness.fixture.debugElement.query(By.directive(PageComponent)).componentInstance.id;
  }

  async function back(): Promise<void> {
    TestBed.inject(Location).back();
    await harness.fixture.whenStable();
    await settle();
  }

  beforeEach(async () => {
    created = 0;
    TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideRouter([
          {
            path: '',
            component: ShellComponent,
            children: [
              { path: 'discover', component: PageComponent },
              { path: 'media/:id', component: PageComponent },
              { path: 'people/:id', component: PageComponent },
              { path: 'form', component: FormComponent, canDeactivate: [() => true] },
              { path: 'play', component: PageComponent, data: { keepAlive: false } },
            ],
          },
        ]),
        { provide: RouteReuseStrategy, useExisting: PageCacheStrategy },
      ],
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
    router.initialNavigation();
    await settle();
  });

  it('brings the same page back on history back', async () => {
    await harness.navigateByUrl('/media/1');
    const first = pageId();
    await harness.navigateByUrl('/people/2');

    await back();

    expect(router.url).toBe('/media/1');
    expect(pageId()).toBe(first);
  });

  it('creates a fresh page on a regular link to a cached url', async () => {
    await harness.navigateByUrl('/media/1');
    const first = pageId();
    await harness.navigateByUrl('/people/2');
    await harness.navigateByUrl('/media/1');

    expect(pageId()).not.toBe(first);
  });

  it('brings a bottom nav tab back as it was', async () => {
    await harness.navigateByUrl('/discover');
    const first = pageId();
    await harness.navigateByUrl('/media/1');
    await harness.navigateByUrl('/discover');

    expect(pageId()).toBe(first);
  });

  it('does not keep forms or pages opting out', async () => {
    const strategy = TestBed.inject(PageCacheStrategy);
    await harness.navigateByUrl('/form');
    await harness.navigateByUrl('/play');
    await harness.navigateByUrl('/discover');

    expect(strategy.retrieveStoredRouteHandles()).toHaveLength(0);
  });

  it('resets the layout when leaving a page and replays it when coming back', async () => {
    const layout = TestBed.inject(LayoutService);
    await harness.navigateByUrl('/media/1');
    layout.navOverlay.set(true);
    layout.navSolidAt.set(520);
    await harness.navigateByUrl('/people/2');

    expect(layout.navOverlay()).toBe(false);

    await back();

    expect(layout.navOverlay()).toBe(true);
    expect(layout.navSolidAt()).toBe(520);
  });

  it('destroys every kept page on clear', async () => {
    const strategy = TestBed.inject(PageCacheStrategy);
    await harness.navigateByUrl('/media/1');
    await harness.navigateByUrl('/people/2');
    expect(strategy.retrieveStoredRouteHandles()).toHaveLength(1);

    strategy.clear();

    expect(strategy.retrieveStoredRouteHandles()).toHaveLength(0);
  });
});
