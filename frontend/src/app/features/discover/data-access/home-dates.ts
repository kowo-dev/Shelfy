import { daysBetween } from './home-discovery';

export interface DayParts {
  day: number;
  month: string;
  weekday: string;
  days: number;
}

const atNoon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

export function dayParts(iso: string, today: string, lang: string): DayParts {
  const date = atNoon(iso);
  return {
    day: date.getDate(),
    month: new Intl.DateTimeFormat(lang, { month: 'short' })
      .format(date)
      .replace('.', '')
      .toUpperCase(),
    weekday: new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(date).replace('.', ''),
    days: daysBetween(today, iso.slice(0, 10)),
  };
}

export function shortDate(iso: string, today: string, lang: string): string {
  const date = atNoon(iso);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}
