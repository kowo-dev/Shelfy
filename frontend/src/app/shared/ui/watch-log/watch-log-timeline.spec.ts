import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';
import type { WatchLogEntry } from '@app/core/services/watch-log/watch-log.model';

import { WatchLogTimelineComponent } from './watch-log-timeline';

function entry(id: string, occurredAt: string): WatchLogEntry {
  return {
    id,
    occurredAt,
    isRewatch: false,
    name: null,
    rating: null,
    review: null,
    containsSpoilers: false,
  } as WatchLogEntry;
}

describe('WatchLogTimelineComponent', () => {
  function render(entries: WatchLogEntry[], limit: number | null = null) {
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(WatchLogTimelineComponent);
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('kind', 'watch');
    fixture.componentRef.setInput('limit', limit);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const entries = [
    entry('old', '2022-05-01'),
    entry('new', '2026-03-03'),
    entry('mid', '2026-01-01'),
  ];

  it('lists newest first as cards dated in full', () => {
    const el = render(entries);

    const rows = [...el.querySelectorAll('li')].map((li) => li.textContent ?? '');
    expect(rows.map((row) => row.match(/\d{4}/)?.[0])).toEqual(['2026', '2026', '2022']);
    expect(rows[0]).toContain('March 3, 2026');
  });

  it('shows the rating and hides a spoiler review behind its guard', () => {
    const el = render([
      {
        ...entry('one', '2026-03-03'),
        rating: 8,
        review: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Still great' }] }],
        },
        containsSpoilers: true,
      },
    ]);

    expect(el.querySelector('shelfy-rating-value')).not.toBeNull();
    expect(el.querySelector('shelfy-spoiler-guard')?.textContent).toContain(
      'review.spoiler_warning',
    );
    expect(el.textContent).not.toContain('Still great');
  });

  it('keeps only the latest entries with a limit', () => {
    const el = render(entries, 2);

    expect(el.querySelectorAll('button').length).toBe(2);
  });
});
