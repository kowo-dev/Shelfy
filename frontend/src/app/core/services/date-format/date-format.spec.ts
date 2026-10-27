import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';
import { DateFormatService } from './date-format';

describe('DateFormatService.formatRelative', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

  function service(): DateFormatService {
    TestBed.configureTestingModule({
      providers: [{ provide: LocalStorageService, useValue: { getItem: () => null } }],
    });
    return TestBed.inject(DateFormatService);
  }

  it('uses days, then months, then years', () => {
    const s = service();
    expect(s.formatRelative(daysAgo(0), 'en', now)).toBe('today');
    expect(s.formatRelative(daysAgo(1), 'en', now)).toBe('yesterday');
    expect(s.formatRelative(daysAgo(12), 'en', now)).toBe('12 days ago');
    expect(s.formatRelative(daysAgo(120), 'en', now)).toBe('4 mo. ago');
    expect(s.formatRelative(daysAgo(800), 'en', now)).toBe('2 yr. ago');
    expect(s.formatRelative(new Date(''), 'en', now)).toBe('');
  });

  it('counts minutes and hours before falling back to days', () => {
    const s = service();
    const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
    expect(s.formatElapsed(minutesAgo(0), 'en', now)).toBe('now');
    expect(s.formatElapsed(minutesAgo(5), 'en', now)).toBe('5 min. ago');
    expect(s.formatElapsed(minutesAgo(180), 'en', now)).toBe('3 hr. ago');
    expect(s.formatElapsed(minutesAgo(3 * 24 * 60), 'en', now)).toBe('3 days ago');
  });
});
