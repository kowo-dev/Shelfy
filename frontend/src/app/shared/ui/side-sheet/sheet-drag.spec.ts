import { vi, type Mock } from 'vitest';
import { SheetDrag } from './sheet-drag';

function pointer(y: number, time: number, button = 0): PointerEvent {
  return {
    button,
    clientY: y,
    timeStamp: time,
    pointerId: 1,
    currentTarget: { setPointerCapture: vi.fn() },
  } as unknown as PointerEvent;
}

describe('SheetDrag', () => {
  let release: Mock<(dismiss: boolean) => void>;
  let drag: SheetDrag;

  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    release = vi.fn<(dismiss: boolean) => void>();
    drag = new SheetDrag(() => 400, release);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('does not start from a secondary button or on a wide screen', () => {
    drag.start(pointer(0, 0, 2));
    drag.move(pointer(200, 100));
    expect(drag.dragging()).toBe(false);

    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    drag.start(pointer(0, 0));
    drag.move(pointer(200, 100));
    expect(drag.dragging()).toBe(false);
  });

  it('waits for the slop before it starts dragging', () => {
    drag.start(pointer(0, 0));
    drag.move(pointer(4, 10));
    expect(drag.dragging()).toBe(false);

    drag.move(pointer(20, 20));
    expect(drag.dragging()).toBe(true);
    expect(drag.offset()).toBe(14);
    expect(drag.translate()).toBe('0 14px');
  });

  it('gives up when the first move goes upward', () => {
    drag.start(pointer(100, 0));
    drag.move(pointer(80, 10));
    drag.move(pointer(300, 20));

    expect(drag.dragging()).toBe(false);
  });

  it('snaps back when released early and slowly', () => {
    drag.start(pointer(0, 0));
    drag.move(pointer(60, 1000));
    drag.end();

    expect(release).toHaveBeenCalledWith(false);
    expect(drag.offset()).toBe(0);
  });

  it('dismisses when dragged past a quarter of the height', () => {
    drag.start(pointer(0, 0));
    drag.move(pointer(160, 1000));
    drag.end();

    expect(release).toHaveBeenCalledWith(true);
  });

  it('dismisses on a quick flick even over a short distance', () => {
    drag.start(pointer(0, 0));
    drag.move(pointer(10, 10));
    drag.move(pointer(60, 20));
    drag.end();

    expect(release).toHaveBeenCalledWith(true);
  });

  it('ignores the end of a gesture that never became a drag', () => {
    drag.start(pointer(0, 0));
    drag.end();

    expect(release).not.toHaveBeenCalled();
  });
});
