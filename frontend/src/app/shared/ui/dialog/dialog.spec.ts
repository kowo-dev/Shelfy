import { TestBed } from '@angular/core/testing';

import { DialogComponent } from './dialog';

describe('DialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogComponent],
    }).compileComponents();
  });

  function createComponent(open = true) {
    const fixture = TestBed.createComponent(DialogComponent);
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('title', 'My dialog');
    fixture.detectChanges();
    return fixture;
  }

  it('does not render when closed', () => {
    const fixture = createComponent(false);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the title when open', () => {
    const fixture = createComponent(true);
    expect(fixture.nativeElement.textContent).toContain('My dialog');
  });

  it('hides the header when hideHeader is true', () => {
    const fixture = createComponent(true);
    fixture.componentRef.setInput('hideHeader', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('My dialog');
  });

  it('requestClose() starts the closing animation but keeps content mounted', () => {
    const fixture = createComponent(true);
    fixture.componentInstance.requestClose();
    fixture.detectChanges();

    expect(fixture.componentInstance.closing()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('emits closed once the panel close animation ends', () => {
    const fixture = createComponent(true);
    const emitted: void[] = [];
    fixture.componentInstance.closed.subscribe(() => emitted.push(undefined));

    fixture.componentInstance.requestClose();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelectorAll('div')[1] as HTMLDivElement;
    const event = new Event('animationend');
    Object.defineProperty(event, 'target', { value: panel });
    Object.defineProperty(event, 'currentTarget', { value: panel });
    panel.dispatchEvent(event);

    expect(emitted.length).toBe(1);
    expect(fixture.componentInstance.closing()).toBe(false);
  });

  it('requestClose() is a no-op when already closed', () => {
    const fixture = createComponent(false);
    fixture.componentInstance.requestClose();

    expect(fixture.componentInstance.closing()).toBe(false);
  });

  it('closing via Escape key calls requestClose()', () => {
    const fixture = createComponent(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(fixture.componentInstance.closing()).toBe(true);
  });
});
