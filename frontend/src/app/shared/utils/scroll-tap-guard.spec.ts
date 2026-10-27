import { guardTapsWhileScrolling } from './scroll-tap-guard';

describe('guardTapsWhileScrolling', () => {
  let time: number;
  let release: () => void;
  let button: HTMLButtonElement;
  let clicks: number;

  const pointer = (type: string, x = 0, y = 0, pointerType = 'touch'): void => {
    button.dispatchEvent(
      Object.assign(new Event(type, { bubbles: true }), { clientX: x, clientY: y, pointerType }),
    );
  };
  const tap = (): void => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  };

  beforeEach(() => {
    time = 1000;
    clicks = 0;
    button = document.createElement('button');
    button.addEventListener('click', () => clicks++);
    document.body.appendChild(button);
    release = guardTapsWhileScrolling(document, () => time);
  });

  afterEach(() => {
    release();
    button.remove();
  });

  it('lets a plain tap through', () => {
    pointer('pointerdown');
    tap();
    expect(clicks).toBe(1);
  });

  it('swallows the tap that stops a momentum scroll', () => {
    document.dispatchEvent(new Event('scroll'));
    time += 50;
    pointer('pointerdown');
    tap();
    expect(clicks).toBe(0);
  });

  it('lets a tap through once scrolling has settled', () => {
    document.dispatchEvent(new Event('scroll'));
    time += 400;
    pointer('pointerdown');
    tap();
    expect(clicks).toBe(1);
  });

  it('swallows a tap whose finger travelled like a swipe', () => {
    pointer('pointerdown', 10, 10);
    pointer('pointermove', 10, 40);
    tap();
    expect(clicks).toBe(0);
  });

  it('ignores mouse movement and keyboard clicks', () => {
    pointer('pointerdown', 10, 10, 'mouse');
    pointer('pointermove', 10, 80, 'mouse');
    tap();
    pointer('pointerdown', 10, 10);
    pointer('pointermove', 10, 80);
    button.click();
    expect(clicks).toBe(2);
  });
});
