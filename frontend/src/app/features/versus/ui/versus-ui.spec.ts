import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { VersusService } from '@app/core/services/versus/versus';
import type {
  VersusEntry,
  VersusMatchResponse,
  VersusPodiumEntry,
} from '@app/core/services/versus/versus.model';
import { ClipSheetComponent } from './clip-sheet/clip-sheet';
import { VersusBracketMapComponent } from './versus-bracket-map/versus-bracket-map';
import { VersusPodiumComponent } from './versus-podium/versus-podium';

const translate = { get: (key: string) => key, lang: () => 'en' };

function entry(id: string, overrides: Partial<VersusEntry> = {}): VersusEntry {
  return { id, title: `Entry ${id}`, coverUrl: null, media: null, clip: null, ...overrides };
}

const clipEntry = (id = 'e1') =>
  entry(id, {
    clip: { provider: 'youtube', externalId: 'abc', title: 'Opening', startSeconds: 12 } as never,
  });

describe('ClipSheetComponent', () => {
  let resolveClip: ReturnType<typeof vi.fn>;
  let toast: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  function render(editing: VersusEntry | null = null) {
    resolveClip = vi.fn().mockReturnValue(of(clipEntry()));
    toast = { error: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ClipSheetComponent],
      providers: [
        { provide: VersusService, useValue: { resolveClip } },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'failed' } },
        { provide: TranslateService, useValue: translate },
        { provide: TmdbService, useValue: { imageUrl: (p: string | null) => p } },
        { provide: IgdbService, useValue: { imageUrl: (p: string | null) => p } },
      ],
    });
    const fixture = TestBed.createComponent(ClipSheetComponent);
    fixture.componentRef.setInput('editing', editing);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('cannot submit before a link was checked', () => {
    expect(render().canSubmit()).toBe(false);
  });

  it('ignores a blank link and a second check while one is running', () => {
    const sheet = render();
    sheet.preview();
    expect(resolveClip).not.toHaveBeenCalled();

    resolveClip.mockReturnValue(new Subject());
    sheet.url.set('https://youtu.be/abc');
    sheet.preview();
    sheet.preview();

    expect(resolveClip).toHaveBeenCalledTimes(1);
    expect(sheet.loading()).toBe(true);
  });

  it('previews a valid link and allows adding it', () => {
    const sheet = render();
    sheet.url.set(' https://youtu.be/abc ');

    sheet.preview();

    expect(resolveClip).toHaveBeenCalledWith('https://youtu.be/abc');
    expect(sheet.draft()?.title).toBe('Opening');
    expect(sheet.canSubmit()).toBe(true);
  });

  it('clears the preview and reports an unusable link', () => {
    const sheet = render();
    resolveClip.mockReturnValue(throwError(() => new Error('bad link')));
    sheet.url.set('nope');

    sheet.preview();

    expect(sheet.previewEntry()).toBeNull();
    expect(sheet.loading()).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('failed');
  });

  it('adds the clip, remembers its title and gets ready for the next one', () => {
    const sheet = render();
    const added = vi.fn();
    sheet.added.subscribe(added);
    sheet.url.set('https://youtu.be/abc');
    sheet.preview();

    sheet.submit();

    expect(added).toHaveBeenCalledWith({
      url: 'https://youtu.be/abc',
      startSeconds: 12,
      linkedMedia: null,
    });
    expect(sheet.recent()).toEqual(['Opening']);
    expect(sheet.url()).toBe('');
    expect(sheet.previewEntry()).toBeNull();
  });

  it('starts from the existing clip when editing, and saves instead of adding', () => {
    const sheet = render(clipEntry('e9'));
    const updated = vi.fn();
    const closed = vi.fn();
    const added = vi.fn();
    sheet.updated.subscribe(updated);
    sheet.closed.subscribe(closed);
    sheet.added.subscribe(added);

    expect(sheet.url()).toBe('https://www.youtube.com/watch?v=abc');
    sheet.submit();

    expect(updated).toHaveBeenCalledWith({
      entryId: 'e9',
      request: { startSeconds: 12, linkedMedia: null },
    });
    expect(closed).toHaveBeenCalled();
    expect(added).not.toHaveBeenCalled();
  });

  it('tells the user when the clipboard cannot be read', () => {
    const sheet = render();
    vi.stubGlobal('navigator', {});

    sheet.paste();

    expect(toast.info).toHaveBeenCalledWith('versus.clip.paste_blocked');
    vi.unstubAllGlobals();
  });

  it('pastes the clipboard link and checks it', async () => {
    const sheet = render();
    vi.stubGlobal('navigator', {
      clipboard: { readText: () => Promise.resolve(' https://youtu.be/abc ') },
    });

    sheet.paste();

    await vi.waitFor(() => expect(resolveClip).toHaveBeenCalledWith('https://youtu.be/abc'));
    vi.unstubAllGlobals();
  });
});

describe('VersusPodiumComponent', () => {
  const place = (id: string, n: number): VersusPodiumEntry => ({
    entry: entry(id),
    place: n,
    communityRank: null,
  });

  function render(podium: VersusPodiumEntry[], compact = false) {
    TestBed.configureTestingModule({
      imports: [VersusPodiumComponent],
      providers: [{ provide: TranslateService, useValue: translate }],
    });
    const fixture = TestBed.createComponent(VersusPodiumComponent);
    fixture.componentRef.setInput('podium', podium);
    fixture.componentRef.setInput('compact', compact);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('finds first, second and every third place', () => {
    const podium = render([place('a', 1), place('b', 2), place('c', 3), place('d', 3)]);

    expect(podium.first()?.entry.id).toBe('a');
    expect(podium.second()?.entry.id).toBe('b');
    expect(podium.thirds().map((p) => p.entry.id)).toEqual(['c', 'd']);
  });

  it('copes with a missing place', () => {
    const podium = render([place('a', 1)]);

    expect(podium.second()).toBeNull();
    expect(podium.thirds()).toEqual([]);
  });
});

describe('VersusBracketMapComponent', () => {
  const match = (
    id: string,
    round: number,
    slotIndex: number,
    overrides: Partial<VersusMatchResponse> = {},
  ): VersusMatchResponse => ({
    id,
    round,
    slotIndex,
    entryA: entry('a'),
    entryB: entry('b'),
    winnerEntryId: null,
    isDecided: false,
    ...overrides,
  });

  function render(matches: VersusMatchResponse[], roundsTotal: number) {
    TestBed.configureTestingModule({
      imports: [VersusBracketMapComponent],
      providers: [{ provide: TranslateService, useValue: translate }],
    });
    const fixture = TestBed.createComponent(VersusBracketMapComponent);
    fixture.componentRef.setInput('matches', matches);
    fixture.componentRef.setInput('roundsTotal', roundsTotal);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('groups matches by round, in order, and orders each round by slot', () => {
    const bracket = render([match('m3', 2, 0), match('m2', 1, 1), match('m1', 1, 0)], 2);

    expect(bracket.columns().map((c) => c.round)).toEqual([1, 2]);
    expect(bracket.columns()[0].matches.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('names the last rounds and counts the entries left in the others', () => {
    const bracket = render([match('a', 1, 0), match('b', 2, 0), match('c', 3, 0)], 3);

    expect(bracket.columns().map((c) => [c.labelKey, c.params['count']])).toEqual([
      ['versus.play.round_of', 8],
      ['versus.play.semi_final', 4],
      ['versus.play.final', 2],
    ]);
  });

  it('tells the winner and the loser of a decided match', () => {
    const bracket = render([], 1);
    const decided = match('m', 1, 0, { isDecided: true, winnerEntryId: 'a' });

    expect(bracket.won(decided, entry('a'))).toBe(true);
    expect(bracket.lost(decided, entry('b'))).toBe(true);
    expect(bracket.lost(match('m', 1, 0), entry('b'))).toBe(false);
    expect(bracket.won(match('m', 1, 0), entry('a'))).toBe(false);
  });
});
