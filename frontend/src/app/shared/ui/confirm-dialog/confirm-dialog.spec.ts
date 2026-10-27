import { TestBed } from '@angular/core/testing';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { TranslateService } from '@app/core/services/translate/translate';
import { ConfirmDialogComponent } from './confirm-dialog';

describe('ConfirmDialogComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('shows the full link and holds the confirm button until the delay is over', () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    const confirm = TestBed.inject(ConfirmService);
    void confirm.ask('Leave?', { url: 'https://example.com/a/b', delaySeconds: 5 });
    fixture.detectChanges();

    expect(fixture.componentInstance.remaining()).toBe(5);
    vi.advanceTimersByTime(4000);
    expect(fixture.componentInstance.remaining()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(fixture.componentInstance.remaining()).toBe(0);
  });

  it('has no delay by default', () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    void TestBed.inject(ConfirmService).ask('Sure?');
    fixture.detectChanges();

    expect(fixture.componentInstance.remaining()).toBe(0);
  });
});
