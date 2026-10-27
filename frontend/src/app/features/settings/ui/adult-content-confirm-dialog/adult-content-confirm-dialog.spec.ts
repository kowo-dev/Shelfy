import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';

import { AdultContentConfirmDialogComponent } from './adult-content-confirm-dialog';

describe('AdultContentConfirmDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdultContentConfirmDialogComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function create(open: boolean) {
    const fixture = TestBed.createComponent(AdultContentConfirmDialogComponent);
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
    return fixture;
  }

  it('renders nothing when closed', () => {
    const fixture = create(false);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('emits confirm when the confirm button is clicked', () => {
    const fixture = create(true);
    const confirmSpy = vi.fn();
    fixture.componentInstance.confirm.subscribe(confirmSpy);

    const buttons = fixture.nativeElement.querySelectorAll('shelfy-button button');
    (buttons[buttons.length - 1] as HTMLButtonElement).click();

    expect(confirmSpy).toHaveBeenCalled();
  });

  it('emits closed when the cancel button is clicked', () => {
    const fixture = create(true);
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    const buttons = fixture.nativeElement.querySelectorAll('shelfy-button button');
    (buttons[buttons.length - 2] as HTMLButtonElement).click();

    expect(closedSpy).toHaveBeenCalled();
  });
});
