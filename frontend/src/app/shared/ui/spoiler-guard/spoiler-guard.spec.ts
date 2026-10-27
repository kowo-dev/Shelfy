import { TestBed } from '@angular/core/testing';

import { SpoilerGuardComponent } from './spoiler-guard';

describe('SpoilerGuardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpoilerGuardComponent],
    }).compileComponents();
  });

  function createComponent(spoiler = true, interactive = true) {
    const fixture = TestBed.createComponent(SpoilerGuardComponent);
    fixture.componentRef.setInput('spoiler', spoiler);
    fixture.componentRef.setInput('interactive', interactive);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the warning and hides the projected content when spoiler is true', () => {
    const fixture = createComponent(true);
    expect(fixture.nativeElement.textContent).toContain('review.spoiler_warning');
  });

  it('shows the reveal button when spoiler is true and interactive', () => {
    const fixture = createComponent(true, true);
    expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
  });

  it('hides the reveal button when not interactive', () => {
    const fixture = createComponent(true, false);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('does not show the warning when spoiler is false', () => {
    const fixture = createComponent(false);
    expect(fixture.nativeElement.textContent).not.toContain('review.spoiler_warning');
  });

  it('reveal() marks the content as revealed and prevents the default event', () => {
    const fixture = createComponent(true);
    const event = { preventDefault: () => {}, stopPropagation: () => {} } as unknown as Event;

    expect(fixture.componentInstance.revealed()).toBe(false);
    fixture.componentInstance.reveal(event);

    expect(fixture.componentInstance.revealed()).toBe(true);
  });

  it('clicking the reveal button hides the warning', () => {
    const fixture = createComponent(true);
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('review.spoiler_warning');
  });

  it('changing resetKey resets the revealed state', () => {
    const fixture = createComponent(true);
    fixture.componentInstance.revealed.set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.revealed()).toBe(true);

    fixture.componentRef.setInput('resetKey', 'reset-1');
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(fixture.componentInstance.revealed()).toBe(false);
  });
});
