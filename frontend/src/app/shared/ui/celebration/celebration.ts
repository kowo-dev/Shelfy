import { ChangeDetectionStrategy, Component, ElementRef, effect, inject } from '@angular/core';
import { CelebrationKind, CelebrationService } from '@app/core/services/celebration/celebration';

const TAP_FRESH_MS = 4000;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const BURST: Record<CelebrationKind, { color: string; count: number; reach: number }> = {
  done: { color: 'var(--color-success)', count: 18, reach: 120 },
  rated: { color: 'var(--color-award-light)', count: 18, reach: 130 },
  created: { color: 'var(--color-text)', count: 14, reach: 100 },
  social: { color: 'var(--color-text)', count: 8, reach: 56 },
};

@Component({
  selector: 'shelfy-celebration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    class: 'pointer-events-none fixed inset-0 z-[260] overflow-hidden',
    'aria-hidden': 'true',
    '(document:pointerdown)': 'onPointerDown($event)',
  },
})
export class CelebrationComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly celebration = inject(CelebrationService);
  private tap = { x: 0, y: 0, at: 0 };

  constructor() {
    effect(() => {
      const event = this.celebration.current();
      if (!event || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.burst(this.origin(), BURST[event.kind]);
    });
  }

  onPointerDown(event: PointerEvent): void {
    this.tap = { x: event.clientX, y: event.clientY, at: Date.now() };
  }

  private origin(): { x: number; y: number } {
    if (Date.now() - this.tap.at < TAP_FRESH_MS) return this.tap;
    return { x: innerWidth / 2, y: innerHeight * 0.7 };
  }

  private el(styles: Partial<CSSStyleDeclaration>): HTMLElement {
    const node = document.createElement('div');
    Object.assign(node.style, { position: 'absolute', left: '0', top: '0', ...styles });
    this.host.appendChild(node);
    return node;
  }

  private play(node: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = node.animate(frames, { fill: 'forwards', ...options });
    animation.onfinish = () => node.remove();
    return animation;
  }

  private burst(at: { x: number; y: number }, { color, count, reach }: (typeof BURST)['done']) {
    const ring = this.el({
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      border: `2px solid ${color}`,
    });
    this.play(
      ring,
      [
        { transform: `translate(${at.x - 14}px, ${at.y - 14}px) scale(0.4)`, opacity: 0.7 },
        { transform: `translate(${at.x - 14}px, ${at.y - 14}px) scale(${reach / 18})`, opacity: 0 },
      ],
      { duration: 650, easing: EASE },
    );
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const distance = reach * (0.55 + Math.random() * 0.45);
      const size = 4 + Math.random() * 4;
      const dot = this.el({
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: i % 3 === 0 ? 'var(--color-text)' : color,
      });
      const x = at.x - size / 2;
      const y = at.y - size / 2;
      this.play(
        dot,
        [
          { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
          {
            transform: `translate(${x + Math.cos(angle) * distance}px, ${y + Math.sin(angle) * distance + 18}px) scale(0.2)`,
            opacity: 0,
          },
        ],
        { duration: 650 + Math.random() * 250, easing: EASE },
      );
    }
  }
}
