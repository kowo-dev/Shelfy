import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@app/core/services/translate/translate';

import { RailComponent } from './rail';

describe('RailComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RailComponent],
      providers: [
        provideRouter([]),
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
  });

  it('renders the title, the count and the see-all link only when given', () => {
    const fixture = TestBed.createComponent(RailComponent);
    fixture.componentRef.setInput('title', 'Lists');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain('Lists');
    expect(el.querySelector('a')).toBeNull();

    fixture.componentRef.setInput('viewAllRoute', ['/lists']);
    fixture.componentRef.setInput('count', 4);
    fixture.detectChanges();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/lists');
    expect(el.querySelector('h2')?.textContent).toContain('4');
  });

  it('hides see all until the row is hovered or focused, except on touch', () => {
    const fixture = TestBed.createComponent(RailComponent);
    fixture.componentRef.setInput('title', 'Lists');
    fixture.componentRef.setInput('viewAllRoute', ['/lists']);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a') as HTMLElement;

    expect(link.classList).toContain('opacity-0');
    expect(link.classList).toContain('group-hover/rail:opacity-100');
    expect(link.classList).toContain('group-focus-within/rail:opacity-100');
    expect(link.classList).toContain('touch:opacity-100');
  });

  function renderRail(scrollWidth: number) {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    const fixture = TestBed.createComponent(RailComponent);
    fixture.componentRef.setInput('title', 'Lists');
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the arrows only when the content overflows', () => {
    expect(renderRail(900).nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('the arrows scroll the rail by its whole width', () => {
    const fixture = renderRail(2000);
    const scroller = fixture.nativeElement.querySelector('[class*="snap-x"]') as HTMLElement;
    scroller.scrollBy = vi.fn();

    (fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement).click();

    expect(scroller.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 1000 }));
  });
});
