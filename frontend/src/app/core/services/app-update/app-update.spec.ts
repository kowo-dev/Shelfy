import { TestBed } from '@angular/core/testing';
import { GuardsCheckEnd, NavigationStart, Router } from '@angular/router';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { vi, type Mock } from 'vitest';
import { AppUpdateService } from './app-update';

describe('AppUpdateService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let routerEvents: Subject<unknown>;
  let swUpdate: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionEvent>;
    unrecoverable: Subject<unknown>;
    checkForUpdate: Mock<() => Promise<boolean>>;
    activateUpdate: Mock<() => Promise<boolean>>;
  };
  let reload: Mock;
  let navigate: Mock;

  function setup(controlled = true) {
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      value: { controller: controlled ? {} : null },
      configurable: true,
    });
    versionUpdates = new Subject();
    routerEvents = new Subject();
    swUpdate = {
      isEnabled: true,
      versionUpdates,
      unrecoverable: new Subject(),
      checkForUpdate: vi.fn(() => Promise.resolve(false)),
      activateUpdate: vi.fn(() => Promise.resolve(false)),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: swUpdate },
        { provide: Router, useValue: { events: routerEvents } },
      ],
    });
    const service = TestBed.inject(AppUpdateService);
    const hooks = service as unknown as { reload: () => void; navigate: (url: string) => void };
    reload = vi.fn();
    navigate = vi.fn();
    hooks.reload = reload;
    hooks.navigate = navigate;
    return service;
  }

  afterEach(() => {
    Reflect.deleteProperty(globalThis.navigator, 'serviceWorker');
  });

  it('starts right away for a first visit, without a service worker yet', async () => {
    const service = setup(false);

    await service.checkAtStartup();

    expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('starts the current version when nothing new is published', async () => {
    const service = setup();

    await service.checkAtStartup();

    expect(swUpdate.checkForUpdate).toHaveBeenCalled();
    expect(swUpdate.activateUpdate).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('loads the new version before showing anything when it is ready in time', async () => {
    const service = setup();
    swUpdate.checkForUpdate.mockResolvedValue(true);
    swUpdate.activateUpdate.mockResolvedValue(true);
    let started = false;

    void service.checkAtStartup().then(() => (started = true));
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());

    expect(started).toBe(false);
  });

  it('also moves to a version the service worker found before the app asked', async () => {
    const service = setup();
    swUpdate.checkForUpdate.mockResolvedValue(false);
    swUpdate.activateUpdate.mockResolvedValue(true);

    void service.checkAtStartup();

    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('gives up waiting after the timeout and starts the current version', async () => {
    const service = setup();
    swUpdate.checkForUpdate.mockReturnValue(new Promise(() => undefined));

    await service.checkAtStartup(10);

    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads when the running version can no longer be served', async () => {
    const service = setup();
    await service.checkAtStartup();

    swUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'missing chunk' });

    expect(reload).toHaveBeenCalled();
  });

  it('applies a late update on the next allowed navigation, never in place', async () => {
    const service = setup();
    const destroy = { onDestroy: vi.fn() };
    service.watch(destroy as never);

    swUpdate.activateUpdate.mockResolvedValue(true);
    versionUpdates.next({ type: 'VERSION_READY' } as VersionEvent);
    expect(reload).not.toHaveBeenCalled();

    routerEvents.next(new NavigationStart(1, '/explore'));
    routerEvents.next(new GuardsCheckEnd(1, '/explore', '/explore', {} as never, false));
    expect(navigate).not.toHaveBeenCalled();

    routerEvents.next(new GuardsCheckEnd(2, '/collection', '/collection', {} as never, true));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/collection'));
    expect(swUpdate.activateUpdate).toHaveBeenCalled();
  });
});
