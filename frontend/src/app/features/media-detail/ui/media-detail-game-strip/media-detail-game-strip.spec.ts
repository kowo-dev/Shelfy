import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TranslateService } from '@app/core/services/translate/translate';
import type { GameSummary } from '@app/core/services/igdb/igdb.model';

import { MediaDetailGameStripComponent } from './media-detail-game-strip';

function game(overrides: Partial<GameSummary> = {}): GameSummary {
  return {
    id: 1,
    name: 'Hades',
    summary: '',
    releaseDate: null,
    coverImageId: null,
    screenshotImageIds: [],
    genres: [],
    platforms: [],
    rating: 0,
    ratingCount: 0,
    isAdult: false,
    ...overrides,
  };
}

describe('MediaDetailGameStripComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaDetailGameStripComponent],
      providers: [
        provideRouter([]),
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: IgdbService,
          useValue: {
            imageUrl: (id: string | null, size: string) => (id ? `igdb:${size}:${id}` : null),
          },
        },
      ],
    }).compileComponents();
  });

  function setup(games: GameSummary[], headingKey = 'media.related_games') {
    const fixture = TestBed.createComponent(MediaDetailGameStripComponent);
    fixture.componentRef.setInput('games', games);
    fixture.componentRef.setInput('headingKey', headingKey);
    fixture.detectChanges();
    return fixture;
  }

  it('renders nothing when the list is empty', () => {
    const fixture = setup([]);
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('renders a home card per game with its cover and heading', () => {
    const fixture = setup([game({ id: 42, name: 'Hades', coverImageId: 'cover123' })]);

    const heading = fixture.nativeElement.querySelector('h2') as HTMLHeadingElement;
    expect(heading.textContent).toContain('media.related_games');

    expect(
      fixture.nativeElement.querySelector('shelfy-media-card article')?.getAttribute('aria-label'),
    ).toBe('Hades');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toContain('cover123');
    expect(
      fixture.nativeElement.querySelector('[aria-label^="collection.backlog.add · "]'),
    ).not.toBeNull();
  });

  it('shows no image when there is no cover', () => {
    const fixture = setup([game({ coverImageId: null })]);

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});
