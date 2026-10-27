import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';
import { ScrollTopComponent } from './scroll-top';

@Component({
  imports: [ScrollTopComponent],
  template: `<div #scroller></div>
    <shelfy-scroll-top [target]="scroller" />`,
})
class HostComponent {}

describe('ScrollTopComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  it('appears after scrolling past the threshold and scrolls the target to top', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const scroller = fixture.nativeElement.querySelector('div') as HTMLElement;
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    scroller.scrollTo = vi.fn() as unknown as typeof scroller.scrollTo;

    expect(button.getAttribute('aria-hidden')).toBe('true');

    scroller.scrollTop = 500;
    scroller.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(button.getAttribute('aria-hidden')).toBeNull();

    button.click();
    expect(scroller.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });
});
