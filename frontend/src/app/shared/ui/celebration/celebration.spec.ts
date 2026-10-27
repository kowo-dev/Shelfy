import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { CelebrationService } from '@app/core/services/celebration/celebration';
import { CelebrationComponent } from './celebration';

describe('CelebrationComponent', () => {
  let fixture: ComponentFixture<CelebrationComponent>;
  let service: CelebrationService;
  let animations: { onfinish: (() => void) | null }[];
  let reduced: boolean;

  const host = () => fixture.nativeElement as HTMLElement;
  const fire = (kind: Parameters<CelebrationService['fire']>[0]) => {
    service.fire(kind);
    fixture.detectChanges();
  };

  beforeEach(() => {
    reduced = false;
    animations = [];
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
    HTMLElement.prototype.animate = vi.fn(() => {
      const animation = { onfinish: null as (() => void) | null };
      animations.push(animation);
      return animation as unknown as Animation;
    });
    fixture = TestBed.createComponent(CelebrationComponent);
    service = TestBed.inject(CelebrationService);
    fixture.detectChanges();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows nothing until something is celebrated', () => {
    expect(host().children).toHaveLength(0);
  });

  it.each([
    ['done', 19],
    ['rated', 19],
    ['created', 15],
    ['social', 9],
  ] as const)('bursts a ring and its dots for %s', (kind, nodes) => {
    fire(kind);

    expect(host().children).toHaveLength(nodes);
  });

  it('removes each piece once its animation ends', () => {
    fire('social');

    animations.forEach((animation) => animation.onfinish?.());

    expect(host().children).toHaveLength(0);
  });

  it('stays still for people who asked for less motion', () => {
    reduced = true;

    fire('done');

    expect(host().children).toHaveLength(0);
  });

  it('bursts from where the user just tapped', () => {
    document.dispatchEvent(Object.assign(new Event('pointerdown'), { clientX: 30, clientY: 40 }));

    fire('social');

    const firstFrames = vi.mocked(HTMLElement.prototype.animate).mock.calls[0][0] as Keyframe[];
    expect(firstFrames[0]['transform']).toContain('translate(16px, 26px)');
  });
});
