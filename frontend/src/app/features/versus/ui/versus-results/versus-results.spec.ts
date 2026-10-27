import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@app/core/services/translate/translate';
import type { VersusMediaRankingEntry } from '@app/core/services/versus/versus.model';

import { VersusResultsComponent } from './versus-results';

function entries(count: number): VersusMediaRankingEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    entry: { id: `m${i}`, title: `Title ${i}`, coverUrl: null, media: null, clip: null },
    avgPoints: 1,
    winRate: 0.62,
    appearances: 14,
  })) as unknown as VersusMediaRankingEntry[];
}

describe('VersusResultsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VersusResultsComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function setup(count: number) {
    const fixture = TestBed.createComponent(VersusResultsComponent);
    fixture.componentRef.setInput('entries', entries(count));
    fixture.detectChanges();
    return fixture;
  }

  it('folds the ranks after the top 10 behind a toggle', () => {
    const fixture = setup(14);
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector('button') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('[inert]')).not.toBeNull();

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('[inert]')).toBeNull();
  });

  it('shows no toggle when there are 10 entries or fewer', () => {
    const root = setup(8).nativeElement as HTMLElement;
    expect(root.querySelectorAll('li')).toHaveLength(8);
    expect(root.querySelector('button')).toBeNull();
  });

  it('ranks every entry in a grid with its rank numeral', () => {
    const fixture = setup(14);
    const root = fixture.nativeElement as HTMLElement;
    const numerals = Array.from(root.querySelectorAll('.v-rk-row .rk')).map((el) =>
      el.textContent?.trim(),
    );
    expect(numerals).toHaveLength(14);
    expect(numerals.slice(0, 3)).toEqual(['1', '2', '3']);
    expect(root.querySelectorAll('.v-rk-row .rk.top')).toHaveLength(3);
  });

  it('shows the win rate and duels, never the average points', () => {
    const text = (setup(1).nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('versus.detail.stat_line');
    expect(text).not.toContain('avg');
  });

  it('shows clips as wide playable cards with the volume control', () => {
    const fixture = TestBed.createComponent(VersusResultsComponent);
    fixture.componentRef.setInput(
      'entries',
      entries(3).map((ranked) => ({
        ...ranked,
        entry: {
          ...ranked.entry,
          clip: { provider: 'youtube', externalId: 'x', title: 't', author: null, startSeconds: 0 },
        },
      })),
    );
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('shelfy-clip-player')).toHaveLength(3);
    expect(root.querySelector('shelfy-clip-volume')).not.toBeNull();
    expect(root.querySelector('shelfy-media-card')).toBeNull();
  });
});
