import { ConfirmService } from '@app/core/services/confirm/confirm';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@app/core/services/translate/translate';

import { SideSheetComponent } from './side-sheet';

describe('SideSheetComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SideSheetComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function setup(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(SideSheetComponent);
    fixture.componentRef.setInput('title', 'Collaborators');
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture;
  }

  it('labels the dialog with its title', () => {
    const fixture = setup();
    const aside = fixture.nativeElement.querySelector('aside') as HTMLElement;
    expect(aside.getAttribute('aria-label')).toBe('Collaborators');
    expect(aside.getAttribute('aria-modal')).toBe('true');
  });

  it('Escape starts the exit, and closed fires once the animation ends', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    let closed = 0;
    component.closed.subscribe(() => closed++);

    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.closing()).toBe(true);
    expect(closed).toBe(0);

    (fixture.nativeElement.querySelector('aside') as HTMLElement).dispatchEvent(
      new Event('animationend'),
    );
    expect(closed).toBe(1);
  });

  it('refuses to close while busy', () => {
    const fixture = setup({ busy: true });
    fixture.componentInstance.requestClose();
    expect(fixture.componentInstance.closing()).toBe(false);
  });

  it('asks before closing an unsaved draft and stays open when refused', async () => {
    const fixture = setup({ dirty: true });
    const confirm = TestBed.inject(ConfirmService);
    const ask = vi.spyOn(confirm, 'ask').mockResolvedValue(false);

    await fixture.componentInstance.requestClose();
    expect(ask).toHaveBeenCalled();
    expect(fixture.componentInstance.closing()).toBe(false);

    ask.mockResolvedValue(true);
    await fixture.componentInstance.requestClose();
    expect(fixture.componentInstance.closing()).toBe(true);
  });

  it('leaves an Escape alone when a field inside already handled it', () => {
    const component = setup().componentInstance;
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    event.preventDefault();

    component.onKeydown(event);

    expect(component.closing()).toBe(false);
  });

  it('an elevated sheet does not steal Escape from an element that owns it', () => {
    const fixture = setup({ elevated: true });
    const owner = document.createElement('div');
    owner.setAttribute('data-owns-escape', '');
    const input = document.createElement('input');
    owner.appendChild(input);
    owner.addEventListener('keydown', (event) => event.preventDefault());
    document.body.appendChild(owner);

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(fixture.componentInstance.closing()).toBe(false);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.closing()).toBe(true);
    owner.remove();
  });
});
