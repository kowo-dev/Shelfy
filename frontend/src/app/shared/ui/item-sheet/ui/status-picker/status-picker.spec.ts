import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';

import { StatusPickerComponent } from './status-picker';

describe('StatusPickerComponent', () => {
  it('names done with the verb of the medium', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(StatusPickerComponent);
    fixture.componentRef.setInput('statuses', ['ongoing', 'done']);
    fixture.componentRef.setInput('mediaType', 'game');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('collection.status_done.played');
    expect(fixture.nativeElement.textContent).toContain('collection.status.ongoing');
  });

  it('lays every status in the mock tile grid, the active one carrying its colour', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(StatusPickerComponent);
    fixture.componentRef.setInput('statuses', ['ongoing', 'done', 'dropped', 'planned']);
    fixture.componentRef.setInput('value', 'done');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('[role=radio]').length).toBe(4);
    expect(root.querySelector('[role=radiogroup]')?.classList).toContain('status-picker');
    const active = root.querySelector('[aria-checked=true]') as HTMLElement;
    expect(active.textContent).toContain('collection.status.done');
    expect(active.style.getPropertyValue('--s')).toBe('var(--color-status-done)');
    expect(root.querySelectorAll('[aria-checked=true]')).toHaveLength(1);
  });
});
