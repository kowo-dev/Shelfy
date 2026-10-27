import type { TranslateService } from '@app/core/services/translate/translate';

export type AniListLabelGroup = 'format' | 'source' | 'season';

export function aniListLabel(
  group: AniListLabelGroup,
  value: string,
  translate: TranslateService,
): string {
  const key = `media.anilist.${group}.${value}`;
  const label = translate.get(key);
  if (label !== key) return label;
  const words = value.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function countryLabel(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
