import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ButtonLinkDirective } from './button-link';

@Component({
  standalone: true,
  imports: [ButtonLinkDirective],
  template: `<a shelfyButtonLink [variant]="variant" [block]="block" [extraClass]="extraClass"
    >Link</a
  >`,
})
class HostComponent {
  variant: 'primary' | 'secondary' | 'danger' = 'secondary';
  block = false;
  extraClass = '';
}

describe('ButtonLinkDirective', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
  });

  it('applies the default secondary/md button classes to the anchor', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.className).toContain('bg-button-secondary');
    expect(anchor.className).toContain('h-13');
    expect(anchor.className).toContain('rounded-2xl');
  });

  it('reflects variant and block inputs in the class list', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.variant = 'primary';
    fixture.componentInstance.block = true;
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.className).toContain('h-13');
    expect(anchor.className).toContain('w-full');
    expect(anchor.className).toContain('rounded-2xl');
  });

  it('appends the extraClass input', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.extraClass = 'my-custom-class';
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.className).toContain('my-custom-class');
  });
});
