import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@app/core/services/translate/translate';

import { EditBarComponent } from './edit-bar';

describe('EditBarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditBarComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function setup(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(EditBarComponent);
    fixture.componentRef.setInput('cancelLabel', 'Cancel');
    fixture.componentRef.setInput('saveLabel', 'Save');
    fixture.componentRef.setInput('savedLabel', 'Saved');
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture;
  }

  const buttons = (fixture: ReturnType<typeof setup>) =>
    [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];

  it('is not rendered while hidden', () => {
    expect(setup({ visible: false }).nativeElement.querySelector('button')).toBeNull();
  });

  it('emits cancel and save', () => {
    const fixture = setup();
    let cancelled = 0;
    let saved = 0;
    fixture.componentInstance.cancelRequested.subscribe(() => cancelled++);
    fixture.componentInstance.saveRequested.subscribe(() => saved++);

    const [cancel, save] = buttons(fixture);
    cancel.click();
    save.click();

    expect([cancelled, saved]).toEqual([1, 1]);
  });

  it('cannot save when the form is not valid', () => {
    const fixture = setup({ canSave: false });
    expect(buttons(fixture)[1].disabled).toBe(true);
  });

  it('locks both buttons while saving, then confirms with the saved label', () => {
    const fixture = setup({ state: 'saving' });
    expect(buttons(fixture).every((b) => b.disabled)).toBe(true);

    fixture.componentRef.setInput('state', 'saved');
    fixture.detectChanges();
    expect(buttons(fixture)[1].textContent).toContain('Saved');
  });
});
