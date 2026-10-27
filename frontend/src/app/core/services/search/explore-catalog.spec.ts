import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { ExploreCatalogService, normalizeSearchText } from './explore-catalog';

describe('ExploreCatalogService', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(ExploreCatalogService);
    service.vocabulary.set({
      criteria: [
        { id: 'time-travel', group: 'theme', mediaTypes: ['movie', 'anime'] },
        { id: 'horror', group: 'genre', mediaTypes: ['movie', 'game'] },
      ],
      platforms: [
        { id: 'platform:167', label: 'PlayStation 5', group: 'platform', logoPath: null },
      ],
    });
    service.streamingServices.set([
      { id: 'streaming:8', label: 'Netflix', group: 'streaming', logoPath: '/n.png' },
    ]);
    return service;
  }

  it('normalizes accents, case and apostrophes', () => {
    expect(normalizeSearchText(' Épouvante l’Été ')).toBe('epouvante l ete');
  });

  it('matches criteria through their French and English aliases', () => {
    const service = setup();

    expect(service.suggest('voyage')[0]).toMatchObject({
      kind: 'criterion',
      criterion: { token: 'time-travel', label: null },
    });
    expect(service.suggest('epouv')[0]).toMatchObject({ criterion: { token: 'horror' } });
  });

  it('suggests categories, platforms and streaming services', () => {
    const service = setup();

    expect(service.suggest('jeux')[0]).toMatchObject({ kind: 'category', type: 'game' });
    expect(service.suggest('playst')[0]).toMatchObject({
      criterion: { token: 'platform:167', label: 'PlayStation 5' },
    });
    expect(service.suggest('netf')[0]).toMatchObject({
      criterion: { token: 'streaming:8', label: 'Netflix' },
    });
  });

  it('needs at least two characters', () => {
    expect(setup().suggest('v')).toEqual([]);
  });

  it('knows which media types a criterion can reach', () => {
    const service = setup();

    expect(service.supports({ token: 'time-travel', label: null }, 'game')).toBe(false);
    expect(service.supports({ token: 'platform:6', label: 'PC' }, 'game')).toBe(true);
    expect(service.supports({ token: 'streaming:8', label: 'Netflix' }, 'anime')).toBe(false);
  });
});
