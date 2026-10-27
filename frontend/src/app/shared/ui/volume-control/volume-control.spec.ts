import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';

import { VolumeControlComponent } from './volume-control';

describe('VolumeControlComponent', () => {
  function setup(value: number, muted = false) {
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { get: (k: string) => k, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(VolumeControlComponent);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('muted', muted);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, component: fixture.componentInstance };
  }

  it('shows the level and reports a new one from the slider', () => {
    const { el, component } = setup(40);
    const changed = vi.fn();
    component.valueChange.subscribe(changed);
    const slider = el.querySelector('input[type="range"]') as HTMLInputElement;

    expect(slider.value).toBe('40');
    slider.value = '65';
    slider.dispatchEvent(new Event('input'));
    expect(changed).toHaveBeenCalledWith(65);
  });

  it('mutes from the speaker and reads 0 while muted', () => {
    const { el, component } = setup(40, true);
    const muted = vi.fn();
    component.mutedChange.subscribe(muted);

    expect((el.querySelector('input[type="range"]') as HTMLInputElement).value).toBe('0');
    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe('volume.unmute');
    el.querySelector('button')!.click();
    expect(muted).toHaveBeenCalledWith(false);
  });

  it('raising the slider while muted unmutes', () => {
    const { el, component } = setup(40, true);
    const muted = vi.fn();
    component.mutedChange.subscribe(muted);
    const slider = el.querySelector('input[type="range"]') as HTMLInputElement;

    slider.value = '30';
    slider.dispatchEvent(new Event('input'));
    expect(muted).toHaveBeenCalledWith(false);
  });
});
