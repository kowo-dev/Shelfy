import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';

import { DangerZoneCardComponent } from './danger-zone-card';

describe('DangerZoneCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DangerZoneCardComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  it('emits clearCollection when the clear-collection button is clicked', () => {
    const fixture = TestBed.createComponent(DangerZoneCardComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.clearCollection.subscribe(spy);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    (buttons[0] as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalled();
  });

  it('emits deleteAccount when the delete-account button is clicked', () => {
    const fixture = TestBed.createComponent(DangerZoneCardComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.deleteAccount.subscribe(spy);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    (buttons[1] as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalled();
  });
});
