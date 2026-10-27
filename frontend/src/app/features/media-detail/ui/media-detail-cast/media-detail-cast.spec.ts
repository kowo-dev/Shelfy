import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { TranslateService } from '@app/core/services/translate/translate';
import type { CastMember } from '@app/core/services/tmdb/tmdb.model';

import { MediaDetailCastComponent } from './media-detail-cast';

describe('MediaDetailCastComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaDetailCastComponent],
      providers: [
        provideRouter([]),
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
        {
          provide: TmdbService,
          useValue: {
            imageUrl: (path: string | null, size: string) => (path ? `tmdb:${size}:${path}` : null),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders nothing when cast is empty', () => {
    const fixture = TestBed.createComponent(MediaDetailCastComponent);
    fixture.componentRef.setInput('cast', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('renders a portrait card per cast member, linked to their page', () => {
    const cast: CastMember[] = [
      { id: 1, name: 'T. Chalamet', character: 'Paul Atreides', profilePath: '/tc.jpg' },
      { id: 2, name: 'Z. Zendaya', character: 'Chani', profilePath: null },
    ];
    const fixture = TestBed.createComponent(MediaDetailCastComponent);
    fixture.componentRef.setInput('cast', cast);
    fixture.detectChanges();

    const tiles = Array.from(
      fixture.nativeElement.querySelectorAll('a[href^="/people/"]'),
    ) as HTMLElement[];
    expect(tiles.length).toBe(2);
    expect(tiles[0].getAttribute('href')).toBe('/people/1');
    expect(tiles[0].querySelector('img')?.getAttribute('src')).toBe('tmdb:w185:/tc.jpg');
    expect(tiles[0].textContent).toContain('Paul Atreides');
    expect(tiles[1].getAttribute('href')).toBe('/people/2');
    expect(tiles[1].querySelector('img')).toBeNull();
  });
});
