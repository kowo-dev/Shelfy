import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';

import { DangerConfirmDialogComponent } from './danger-confirm-dialog';

describe('DangerConfirmDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DangerConfirmDialogComponent],
      providers: [
        {
          provide: TranslateService,
          useValue: { get: (key: string) => key, lang: () => 'en' },
        },
      ],
    }).compileComponents();
  });

  function create(overrides: {
    action?: 'clear-collection' | 'delete-account' | null;
    busy?: boolean;
    confirmMatches?: boolean;
  }) {
    const fixture = TestBed.createComponent(DangerConfirmDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('action', overrides.action ?? 'delete-account');
    fixture.componentRef.setInput('confirmControl', new FormControl('', { nonNullable: true }));
    fixture.componentRef.setInput('username', 'kowo');
    fixture.componentRef.setInput('busy', overrides.busy ?? false);
    fixture.componentRef.setInput('confirmMatches', overrides.confirmMatches ?? false);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the delete-account title', () => {
    const fixture = create({ action: 'delete-account' });
    expect(fixture.nativeElement.textContent).toContain(
      'settings.danger_zone.delete_account_confirm_title',
    );
  });

  it('renders the clear-collection title', () => {
    const fixture = create({ action: 'clear-collection' });
    expect(fixture.nativeElement.textContent).toContain(
      'settings.danger_zone.clear_collection_confirm_title',
    );
  });

  it('disables the confirm button when confirmMatches is false', () => {
    const fixture = create({ confirmMatches: false });
    const buttons = fixture.nativeElement.querySelectorAll('shelfy-button button');
    const confirmButton = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
  });

  it('emits confirm when confirmMatches is true and the button is clicked', () => {
    const fixture = create({ confirmMatches: true });
    const confirmSpy = vi.fn();
    fixture.componentInstance.confirm.subscribe(confirmSpy);

    const buttons = fixture.nativeElement.querySelectorAll('shelfy-button button');
    const confirmButton = buttons[buttons.length - 1] as HTMLButtonElement;
    confirmButton.click();

    expect(confirmSpy).toHaveBeenCalled();
  });

  it('emits closed when cancel is clicked', () => {
    const fixture = create({});
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    const buttons = fixture.nativeElement.querySelectorAll('shelfy-button button');
    const cancelButton = buttons[buttons.length - 2] as HTMLButtonElement;
    cancelButton.click();

    expect(closedSpy).toHaveBeenCalled();
  });
});
