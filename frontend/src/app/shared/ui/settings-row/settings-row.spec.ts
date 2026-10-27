import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';

import { SettingsRowComponent } from './settings-row';

@Component({
  standalone: true,
  imports: [SettingsRowComponent],
  template: `<shelfy-settings-row title="Language" description="Pick one"
    ><button>Go</button></shelfy-settings-row
  >`,
})
class HostComponent {}

describe('SettingsRowComponent', () => {
  it('shows the title, the description and the projected control', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Language');
    expect(el.textContent).toContain('Pick one');
    expect(el.querySelector('button')?.textContent).toBe('Go');
  });
});
