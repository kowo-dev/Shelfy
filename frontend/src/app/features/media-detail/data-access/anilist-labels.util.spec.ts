import type { TranslateService } from '@app/core/services/translate/translate';
import { aniListLabel, countryLabel } from './anilist-labels.util';

const translate = {
  get: (key: string) => ({ 'media.anilist.source.LIGHT_NOVEL': 'Light novel' })[key] ?? key,
} as unknown as TranslateService;

describe('aniListLabel', () => {
  it('uses the translation when there is one', () => {
    expect(aniListLabel('source', 'LIGHT_NOVEL', translate)).toBe('Light novel');
  });

  it('turns an untranslated value into words', () => {
    expect(aniListLabel('source', 'MULTIMEDIA_PROJECT', translate)).toBe('Multimedia project');
  });
});

describe('countryLabel', () => {
  it('names the country in the given language', () => {
    expect(countryLabel('JP', 'fr')).toBe('Japon');
    expect(countryLabel('KR', 'en')).toBe('South Korea');
  });
});
