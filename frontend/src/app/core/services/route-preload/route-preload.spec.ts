import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';
import { RoutePreloadStrategy } from './route-preload';

describe('RoutePreloadStrategy', () => {
  const strategy = new RoutePreloadStrategy();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips routes that are not flagged', async () => {
    const load = vi.fn(() => of('chunk'));
    expect(await firstValueFrom(strategy.preload({ path: 'settings' }, load))).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('loads flagged routes once downloads have been quiet and the browser is idle', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
      callback();
      return 1;
    });
    const load = vi.fn(() => of('chunk'));
    const result = firstValueFrom(
      strategy.preload({ path: 'collection', data: { preload: true } }, load),
    );
    vi.advanceTimersByTime(1999);
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(await result).toBe('chunk');
    expect(load).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('skips preloading when the visitor saves data', async () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    const load = vi.fn(() => of('chunk'));
    expect(
      await firstValueFrom(strategy.preload({ path: 'collection', data: { preload: true } }, load)),
    ).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
