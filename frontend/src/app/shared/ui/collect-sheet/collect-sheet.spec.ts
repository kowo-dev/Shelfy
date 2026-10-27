import { of } from 'rxjs';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CollectSheetService } from '@app/core/services/collect/collect-sheet';
import type { EditableCreation } from '@app/core/services/collect/collect.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ListsService } from '@app/core/services/lists/lists';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { VersusService } from '@app/core/services/versus/versus';

import { CollectSheetComponent } from './collect-sheet';

function target(overrides: Partial<EditableCreation> = {}): EditableCreation {
  return {
    id: 'l1',
    name: 'Comfort picks',
    visibility: 'public',
    itemCount: 3,
    covers: [],
    isOwner: true,
    hasClips: false,
    containedId: null,
    ...overrides,
  };
}

const DUNE = { provider: 'tmdb', mediaType: 'movie' as const, externalId: '438631', title: 'Dune' };

describe('CollectSheetComponent', () => {
  type Mock = ReturnType<typeof vi.fn>;
  let lists: { editable: Mock; addItems: Mock; removeItems: Mock; create: Mock };
  let versus: { editable: Mock; addItems: Mock; removeItems: Mock; createPool: Mock };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function setup(
    listTargets: EditableCreation[] = [target()],
    poolTargets: EditableCreation[] = [],
  ) {
    lists = {
      editable: vi.fn().mockReturnValue(of(listTargets)),
      addItems: vi
        .fn()
        .mockReturnValue(
          of({ media: [{ id: 'm9', provider: 'tmdb', mediaType: 'movie', externalId: '438631' }] }),
        ),
      removeItems: vi.fn().mockReturnValue(of({ media: [] })),
      create: vi.fn(),
    };
    versus = {
      editable: vi.fn().mockReturnValue(of(poolTargets)),
      addItems: vi.fn(),
      removeItems: vi.fn(),
      createPool: vi.fn(),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [CollectSheetComponent],
      providers: [
        provideRouter([]),
        { provide: ListsService, useValue: lists },
        { provide: VersusService, useValue: versus },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(CollectSheetComponent);
    fixture.detectChanges();
    return fixture;
  }

  function rows(fixture: ReturnType<typeof setup>): HTMLButtonElement[] {
    return [...fixture.nativeElement.querySelectorAll('li button')];
  }

  it('asks which lists already hold a single title', () => {
    const fixture = setup();
    TestBed.inject(CollectSheetService).open([DUNE]);
    fixture.detectChanges();

    expect(lists.editable).toHaveBeenCalledWith({
      provider: 'tmdb',
      mediaType: 'movie',
      externalId: '438631',
    });
  });

  it('adds the title to a list, then takes it back out on a second tap', () => {
    const fixture = setup();
    TestBed.inject(CollectSheetService).open([DUNE]);
    fixture.detectChanges();

    rows(fixture)[0].click();
    fixture.detectChanges();
    expect(lists.addItems).toHaveBeenCalledWith('l1', [
      { provider: 'tmdb', mediaType: 'movie', externalId: '438631' },
    ]);
    expect(rows(fixture)[0].getAttribute('aria-pressed')).toBe('true');
    expect(toast.success).toHaveBeenCalled();

    rows(fixture)[0].click();
    fixture.detectChanges();
    expect(lists.removeItems).toHaveBeenCalledWith('l1', ['m9']);
    expect(rows(fixture)[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('tells Cancel, Done and a dismissal apart when it closes', async () => {
    const fixture = setup();
    const sheet = TestBed.inject(CollectSheetService);
    sheet.open([DUNE]);
    fixture.detectChanges();
    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];

    const cancelled = sheet.whenClosed();
    buttons.find((b) => b.textContent?.includes('collection.cancel'))!.click();
    expect(await cancelled).toBe('cancelled');

    sheet.open([DUNE]);
    const done = sheet.whenClosed();
    buttons.find((b) => b.textContent?.includes('collection.sheet.done'))!.click();
    expect(await done).toBe('done');

    sheet.open([DUNE]);
    const dismissed = sheet.whenClosed();
    sheet.close();
    expect(await dismissed).toBe('dismissed');
  });

  it('does not offer versus made of video clips', () => {
    const fixture = setup([], [target({ id: 'p1', hasClips: true })]);
    const component = fixture.componentInstance as unknown as { kind: { set(v: string): void } };
    TestBed.inject(CollectSheetService).open([DUNE]);
    component.kind.set('versus');
    fixture.detectChanges();

    expect(rows(fixture)[0].disabled).toBe(true);
  });

  it('adds several titles at once without looking any of them up', () => {
    const fixture = setup();
    TestBed.inject(CollectSheetService).open([
      DUNE,
      { ...DUNE, externalId: '1', title: 'Arrival' },
    ]);
    fixture.detectChanges();

    expect(lists.editable).toHaveBeenCalledWith(undefined);
    rows(fixture)[0].click();
    expect(lists.addItems).toHaveBeenCalledWith('l1', [
      { provider: 'tmdb', mediaType: 'movie', externalId: '438631' },
      { provider: 'tmdb', mediaType: 'movie', externalId: '1' },
    ]);
  });
});
