import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';
import { ImportProgressComponent, type ImportRow } from './import-progress';

const TRANSLATED = 'settings.import.steam.reasons.not_found';

describe('ImportProgressComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportProgressComponent],
      providers: [
        {
          provide: TranslateService,
          useValue: {
            get: (key: string) => (key === TRANSLATED ? 'Not on IGDB' : key),
            lang: () => 'en',
          },
        },
      ],
    }).compileComponents();
  });

  function render(skipped: ImportRow[], imported: ImportRow[] = []): HTMLElement {
    const fixture = TestBed.createComponent(ImportProgressComponent);
    const set = fixture.componentRef.setInput.bind(fixture.componentRef);
    set('prefix', 'settings.import.steam');
    set('summary', { status: 'completed', imported: 1, skipped: 1, total: 2 });
    set('active', false);
    set('progress', 100);
    set('expanded', true);
    set('loading', false);
    set('entryCount', skipped.length + imported.length);
    set('skipped', skipped);
    set('imported', imported);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('translates a known skip reason and falls back to the raw one', () => {
    const text = render([
      { key: 1, name: 'Portal', reason: 'not_found' },
      { key: 2, name: 'Doom', reason: 'mystery' },
      { key: 3, name: 'Quake', reason: null },
    ]).textContent;

    expect(text).toContain('Not on IGDB');
    expect(text).toContain('mystery');
  });

  it('shows the matched title next to an imported entry only when there is one', () => {
    const rows = render(
      [],
      [
        { key: 1, name: 'Portal', detail: 'Portal (2007)' },
        { key: 2, name: 'Doom' },
      ],
    ).querySelectorAll('.text-text-subtle');

    expect([...rows].map((row) => row.textContent?.trim())).toEqual(['Portal (2007)']);
  });

  it('says there is nothing to show for an empty import', () => {
    expect(render([]).textContent).toContain('settings.import.steam.no_entries');
  });
});
