import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm';

describe('ConfirmService', () => {
  let service: ConfirmService;

  beforeEach(() => {
    service = TestBed.inject(ConfirmService);
  });

  it('tells a cancel button from a dismissal', async () => {
    const cancelled = service.choose('Sure?');
    service.answer(false);
    expect(await cancelled).toBe('cancel');

    const dismissed = service.choose('Sure?');
    service.dismiss();
    expect(await dismissed).toBe('dismiss');
    expect(service.message()).toBeNull();
  });

  it('resolves ask to true only when confirmed', async () => {
    const confirmed = service.ask('Sure?');
    service.answer(true);
    expect(await confirmed).toBe(true);

    const dismissed = service.ask('Sure?');
    service.dismiss();
    expect(await dismissed).toBe(false);
  });
});
