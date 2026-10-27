import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { vi } from 'vitest';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { TranslateService } from '@app/core/services/translate/translate';
import { unsavedChangesGuard, type UnsavedChangesAware } from './unsaved-changes-guard';

describe('unsavedChangesGuard', () => {
  const ask = vi.fn();

  beforeEach(() => {
    ask.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfirmService, useValue: { ask } },
        { provide: TranslateService, useValue: { get: (key: string) => key } },
      ],
    });
  });

  const run = (component: UnsavedChangesAware) =>
    TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(
        component,
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  it('lets the user leave without asking when nothing is unsaved', () => {
    expect(run({ hasUnsavedChanges: () => false })).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks the default question and follows the answer when changes are unsaved', () => {
    ask.mockReturnValue(false);

    expect(run({ hasUnsavedChanges: () => true })).toBe(false);
    expect(ask).toHaveBeenCalledWith('edit.unsaved_changes');
  });

  it('asks the question the page chose', () => {
    run({ hasUnsavedChanges: () => true, leaveQuestionKey: () => 'review.leave' });

    expect(ask).toHaveBeenCalledWith('review.leave');
  });
});
