import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MenuButtonComponent, type MenuButtonItem } from './menu-button';

@Component({
  imports: [MenuButtonComponent],
  template: `
    <shelfy-menu-button
      label="Sort"
      icon="sortDesc"
      [items]="items"
      [selectedId]="selected"
      (picked)="picked.push($event)"
    />
    <button id="outside" type="button">outside</button>
  `,
})
class HostComponent {
  items: MenuButtonItem[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
  selected: string | null = 'b';
  picked: string[] = [];
}

@Component({
  imports: [MenuButtonComponent],
  template: `
    <shelfy-menu-button
      label="Media"
      icon="grid"
      [items]="items"
      [selectedIds]="selected"
      (picked)="picked.push($event)"
    />
  `,
})
class MultiHostComponent {
  items: MenuButtonItem[] = [
    { id: 'a', label: 'A', meta: 4 },
    { id: 'b', label: 'B', meta: 0 },
  ];
  selected = ['a'];
  picked: string[] = [];
}

describe('MenuButtonComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const trigger = root.querySelector('shelfy-menu-button button') as HTMLButtonElement;
    const items = () => [...root.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]')];
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, root, trigger, items, settle };
  }

  it('moves focus to the selected item on open and marks it checked', async () => {
    const { trigger, items, settle } = setup();
    trigger.click();
    await settle();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(items().map((item) => item.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(document.activeElement).toBe(items()[1]);
  });

  it('walks the items with the arrow keys, wrapping around', async () => {
    const { trigger, items, settle } = setup();
    trigger.click();
    await settle();

    const press = (key: string) =>
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    press('ArrowDown');
    expect(document.activeElement).toBe(items()[2]);
    press('ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    press('ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
    press('Home');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('closes on Escape and gives focus back to the button', async () => {
    const { trigger, items, settle } = setup();
    trigger.click();
    await settle();

    items()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('emits the pick, closes and restores focus', async () => {
    const { fixture, trigger, items, settle } = setup();
    trigger.click();
    await settle();

    items()[2].click();
    await settle();

    expect(fixture.componentInstance.picked).toEqual(['c']);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when the pointer goes down elsewhere', async () => {
    const { root, trigger, settle } = setup();
    trigger.click();
    await settle();

    root
      .querySelector('#outside')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await settle();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('stays open in multi-select mode and checks every selected item', async () => {
    const fixture = TestBed.createComponent(MultiHostComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    (root.querySelector('shelfy-menu-button button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items = [...root.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]')];

    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'A4',
      'B0',
    ]);

    items[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.picked).toEqual(['b']);
    expect(root.querySelector('[role="menu"]')).not.toBeNull();
  });
});
