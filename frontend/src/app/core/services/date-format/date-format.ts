import { inject, Injectable, signal } from '@angular/core';
import { LocalStorageService } from '@app/core/services/local-storage/local-storage';

const STORAGE_KEY = 'use24HourFormat';

@Injectable({ providedIn: 'root' })
export class DateFormatService {
  private readonly storage = inject(LocalStorageService);

  readonly use24Hour = signal<boolean>(this.storage.getItem(STORAGE_KEY) === 'true');

  setUse24Hour(value: boolean): void {
    this.storage.setItem(STORAGE_KEY, String(value));
    this.use24Hour.set(value);
  }

  formatDate(date: Date, lang: string, dateStyle: 'medium' | 'long' = 'medium'): string {
    return new Intl.DateTimeFormat(lang, { dateStyle }).format(date);
  }

  formatRelative(date: Date, lang: string, now: Date = new Date()): string {
    const days = Math.round((now.getTime() - date.getTime()) / 86_400_000);
    if (!Number.isFinite(days)) return '';
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
    if (days < 30) return rtf.format(-days, 'day');
    if (days < 365) return rtf.format(-Math.round(days / 30), 'month');
    return rtf.format(-Math.round(days / 365), 'year');
  }

  formatElapsed(date: Date, lang: string, now: Date = new Date()): string {
    const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
    if (!Number.isFinite(minutes)) return '';
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
    if (minutes < 1) return rtf.format(0, 'second');
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    if (minutes < 24 * 60) return rtf.format(-Math.round(minutes / 60), 'hour');
    return this.formatRelative(date, lang, now);
  }

  formatDateTime(date: Date, lang: string): string {
    return new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: !this.use24Hour(),
    }).format(date);
  }
}
