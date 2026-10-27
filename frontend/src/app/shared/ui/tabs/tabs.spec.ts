import { TestBed } from '@angular/core/testing';

import { TabsComponent, type TabItem } from './tabs';

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'reviews', label: 'Reviews' },
];

describe('TabsComponent', () => {
  beforeEach(async () => {
    if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
    }

    await TestBed.configureTestingModule({
      imports: [TabsComponent],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup(activeId = 'overview') {
    const fixture = TestBed.createComponent(TabsComponent);
    fixture.componentRef.setInput('tabs', TABS);
    fixture.componentRef.setInput('activeId', activeId);
    fixture.detectChanges();
    return fixture;
  }

  it('renders one button per tab with the labels', () => {
    const fixture = setup();
    const buttons = fixture.nativeElement.querySelectorAll('button[role="tab"]');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('Overview');
    expect(buttons[1].textContent).toContain('Reviews');
  });

  it('marks the active tab with aria-selected', () => {
    const fixture = setup('reviews');
    const buttons = fixture.nativeElement.querySelectorAll('button[role="tab"]');
    expect(buttons[0].getAttribute('aria-selected')).toBe('false');
    expect(buttons[1].getAttribute('aria-selected')).toBe('true');
  });

  it('emits tabSelected with the clicked tab id', () => {
    const fixture = setup();
    const emitted: string[] = [];
    fixture.componentInstance.tabSelected.subscribe((id) => emitted.push(id));

    const buttons = fixture.nativeElement.querySelectorAll('button[role="tab"]');
    (buttons[1] as HTMLButtonElement).click();

    expect(emitted).toEqual(['reviews']);
  });

  it('shows the active tab in white without any underline', () => {
    const fixture = setup('reviews');
    const buttons = fixture.nativeElement.querySelectorAll('button[role="tab"]');
    expect(buttons[1].className).toContain('text-white');
    expect(buttons[0].className).toContain('text-white/34');
    expect(fixture.nativeElement.querySelector('nav > span')).toBeNull();
  });

  it('renders no tab buttons for an empty tabs list', () => {
    const fixture = TestBed.createComponent(TabsComponent);
    fixture.componentRef.setInput('tabs', []);
    fixture.componentRef.setInput('activeId', '');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('button[role="tab"]').length).toBe(0);
  });

  it('navigation mode drops the tab roles and marks the current section', () => {
    const fixture = TestBed.createComponent(TabsComponent);
    fixture.componentRef.setInput('tabs', TABS);
    fixture.componentRef.setInput('activeId', 'reviews');
    fixture.componentRef.setInput('navigation', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="tablist"], [role="tab"]')).toBeNull();
    const buttons = Array.from(el.querySelectorAll('button'));
    expect(buttons.map((b) => b.getAttribute('aria-current'))).toEqual([null, 'location']);
    expect(buttons[0].hasAttribute('tabindex')).toBe(false);
  });
});
