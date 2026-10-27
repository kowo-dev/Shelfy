import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@app/core/errors/api-error';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { FederationService } from '@app/core/services/federation/federation';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { AccountMigrationCardComponent } from './account-migration-card';

const STATUS = { actor: 'https://api.shelfy.test/ap/users/1', alias: null, movedTo: null };

describe('AccountMigrationCardComponent', () => {
  let federation: Record<string, ReturnType<typeof vi.fn>>;
  let confirm: { ask: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn> };

  function create() {
    federation = {
      migration: vi.fn().mockReturnValue(of(STATUS)),
      setAlias: vi.fn().mockReturnValue(of({ ...STATUS, alias: 'https://old.example/users/me' })),
      clearAlias: vi.fn().mockReturnValue(of(STATUS)),
      moveTo: vi.fn().mockReturnValue(of({ ...STATUS, movedTo: 'https://new.example/users/me' })),
    };
    confirm = { ask: vi.fn().mockResolvedValue(true) };
    toast = { success: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: FederationService, useValue: federation },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromError: () => 'generic' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    return TestBed.createComponent(AccountMigrationCardComponent).componentInstance;
  }

  it('loads the status only when the card is opened', () => {
    const card = create();
    expect(federation['migration']).not.toHaveBeenCalled();

    card.toggle();

    expect(federation['migration']).toHaveBeenCalledTimes(1);
    expect(card.status()).toEqual(STATUS);
  });

  it('saves and removes an alias', () => {
    const card = create();
    card.aliasHandle.setValue(' @me@old.example ');

    card.saveAlias();

    expect(federation['setAlias']).toHaveBeenCalledWith('@me@old.example');
    expect(card.status()?.alias).toBe('https://old.example/users/me');
    card.removeAlias();
    expect(federation['clearAlias']).toHaveBeenCalled();
    expect(card.status()?.alias).toBeNull();
  });

  it('asks before moving the account', async () => {
    const card = create();
    card.moveHandle.setValue('@me@new.example');

    await card.move();

    expect(confirm.ask).toHaveBeenCalled();
    expect(federation['moveTo']).toHaveBeenCalledWith('@me@new.example');
    expect(card.status()?.movedTo).toBe('https://new.example/users/me');
  });

  it('does not move the account when the confirmation is declined', async () => {
    const card = create();
    confirm.ask.mockResolvedValue(false);
    card.moveHandle.setValue('@me@new.example');

    await card.move();

    expect(federation['moveTo']).not.toHaveBeenCalled();
  });

  it('shows the reason the server gives when the move is refused', async () => {
    const card = create();
    federation['moveTo'].mockReturnValue(
      throwError(() => new ApiError(400, 'Add the alias first', 'FEDERATION_UNAVAILABLE')),
    );
    card.moveHandle.setValue('@me@new.example');

    await card.move();

    expect(card.error()).toBe('Add the alias first');
    expect(card.busy()).toBeNull();
  });
});
