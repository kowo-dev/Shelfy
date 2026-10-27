import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@app/core/services/translate/translate';

import { LikeButtonComponent } from './like-button';

describe('LikeButtonComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LikeButtonComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function setup(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(LikeButtonComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture;
  }

  const button = (fixture: ReturnType<typeof setup>) =>
    fixture.nativeElement.querySelector('button') as HTMLButtonElement | null;

  it('shows the count and reflects the liked state in aria-pressed', () => {
    const fixture = setup({ liked: true, count: 12 });
    expect(button(fixture)?.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('12');
  });

  it('labels the button with the action, not with visible text', () => {
    const fixture = setup({ liked: false, count: 1 });
    expect(button(fixture)?.getAttribute('aria-label')).toBe('social.like');
    fixture.componentRef.setInput('liked', true);
    fixture.detectChanges();
    expect(button(fixture)?.getAttribute('aria-label')).toBe('social.unlike');
  });

  it('emits toggled on click', () => {
    const fixture = setup({ count: 3 });
    let toggled = 0;
    fixture.componentInstance.toggled.subscribe(() => toggled++);
    button(fixture)?.click();
    expect(toggled).toBe(1);
  });

  it('renders the count only, with no button, when readonly', () => {
    const fixture = setup({ count: 4, readonly: true });
    expect(button(fixture)).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('4');
  });

  it('ignores clicks while a request is pending, and the parent drives the rollback', () => {
    const fixture = setup({ liked: false, count: 2, pending: true });
    let toggled = 0;
    fixture.componentInstance.toggled.subscribe(() => toggled++);
    button(fixture)?.click();
    expect(toggled).toBe(0);

    fixture.componentRef.setInput('pending', false);
    fixture.componentRef.setInput('liked', true);
    fixture.componentRef.setInput('count', 3);
    fixture.detectChanges();
    expect(button(fixture)?.getAttribute('aria-pressed')).toBe('true');
    fixture.componentRef.setInput('liked', false);
    fixture.componentRef.setInput('count', 2);
    fixture.detectChanges();
    expect(button(fixture)?.getAttribute('aria-pressed')).toBe('false');
  });
});
