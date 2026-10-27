import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@app/core/services/translate/translate';

import type { MediaDetailView } from '../../data-access/media-detail-view.util';
import { MediaDetailMetadataComponent } from './media-detail-metadata';

function view(overrides: Partial<MediaDetailView> = {}): MediaDetailView {
  return {
    title: undefined,
    overview: undefined,
    genres: [],
    genreIds: [],
    voteAverage: undefined,
    voteCount: undefined,
    originalTitle: null,
    releaseDate: null,
    releaseYear: null,
    cast: [],
    developers: [],
    developerIds: [],
    publishers: [],
    publisherIds: [],
    studios: [],
    studioRefs: [],
    networks: [],
    networkIds: [],
    director: null,
    directorId: null,
    budget: null,
    revenue: null,
    adultContent: false,
    tags: [],
    tagRefs: [],
    platforms: [],
    platformIds: [],
    themes: [],
    themeIds: [],
    gameModes: [],
    gameModeIds: [],
    storyline: null,
    format: null,
    status: null,
    endDate: null,
    episodes: null,
    chapters: null,
    countryOfOrigin: null,
    runtime: null,
    numberOfSeasons: null,
    numberOfEpisodes: null,
    source: null,
    season: null,
    seasonYear: null,
    popularity: null,
    volumes: null,
    animeCharacters: [],
    mangaCharacters: [],
    trailerUrl: null,
    authors: [],
    authorKeys: [],
    franchiseName: null,
    franchiseId: null,
    dlcs: [],
    posterUrl: null,
    backdropUrl: null,
    galleryImages: [],
    ...overrides,
  };
}

describe('MediaDetailMetadataComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaDetailMetadataComponent],
      providers: [
        provideRouter([]),
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  it('renders nothing when the view carries no metadata', () => {
    const fixture = TestBed.createComponent(MediaDetailMetadataComponent);
    fixture.componentRef.setInput('view', view());
    fixture.componentRef.setInput('mediaType', 'movie');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('keeps credits on the primary tier and the franchise under more details', () => {
    const fixture = TestBed.createComponent(MediaDetailMetadataComponent);
    fixture.componentRef.setInput(
      'view',
      view({
        director: 'D. Villeneuve',
        directorId: 1,
        studios: ['Legendary'],
        studioRefs: [{ id: 10, name: 'Legendary' }],
        franchiseName: 'Dune',
        franchiseId: 5,
      }),
    );
    fixture.componentRef.setInput('mediaType', 'movie');
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    const directorLink = links.find((a) => a.textContent?.includes('D. Villeneuve'));
    const studioLink = links.find((a) => a.textContent?.includes('Legendary'));
    const franchiseLink = links.find((a) => a.textContent?.includes('Dune'));

    expect(directorLink?.getAttribute('href')).toBe('/people/1');
    expect(studioLink?.getAttribute('href')).toBe('/companies/10');
    expect(franchiseLink).toBeUndefined();

    fixture.componentRef.setInput('tier', 'secondary');
    fixture.detectChanges();
    const secondary = Array.from(
      fixture.nativeElement.querySelectorAll('a'),
    ) as HTMLAnchorElement[];
    expect(secondary.find((a) => a.textContent?.includes('Dune'))?.getAttribute('href')).toBe(
      '/franchises/5',
    );
    expect(secondary.some((a) => a.textContent?.includes('D. Villeneuve'))).toBe(false);
  });

  it('links studios to /studios for anime instead of /companies', () => {
    const fixture = TestBed.createComponent(MediaDetailMetadataComponent);
    fixture.componentRef.setInput(
      'view',
      view({
        studios: ['Madhouse'],
        studioRefs: [{ id: 80, name: 'Madhouse' }],
      }),
    );
    fixture.componentRef.setInput('mediaType', 'anime');
    fixture.detectChanges();

    const studioLink = Array.from(fixture.nativeElement.querySelectorAll('a')).find((a) =>
      (a as HTMLAnchorElement).textContent?.includes('Madhouse'),
    ) as HTMLAnchorElement | undefined;

    expect(studioLink?.getAttribute('href')).toBe('/studios/80');
  });

  it('links an anime author and director to their AniList staff page', () => {
    const fixture = TestBed.createComponent(MediaDetailMetadataComponent);
    fixture.componentRef.setInput(
      'view',
      view({
        authors: ['Hajime Isayama'],
        authorKeys: ['21'],
        director: 'Tetsurou Araki',
        directorId: 20,
      }),
    );
    fixture.componentRef.setInput('mediaType', 'anime');
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.find((a) => a.textContent?.includes('Isayama'))?.getAttribute('href')).toBe(
      '/staff/21',
    );
    expect(links.find((a) => a.textContent?.includes('Araki'))?.getAttribute('href')).toBe(
      '/staff/20',
    );
  });

  it('shows AniList source and season as words instead of raw codes', () => {
    const fixture = TestBed.createComponent(MediaDetailMetadataComponent);
    fixture.componentRef.setInput(
      'view',
      view({ source: 'LIGHT_NOVEL', season: 'SPRING', seasonYear: 2024 }),
    );
    fixture.componentRef.setInput('mediaType', 'anime');
    fixture.componentRef.setInput('tier', 'secondary');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Light novel');
    expect(text).toContain('Spring 2024');
    expect(text).not.toContain('LIGHT_NOVEL');
  });

  it('links networks to /networks/:id', () => {
    const fixture = TestBed.createComponent(MediaDetailMetadataComponent);
    fixture.componentRef.setInput(
      'view',
      view({
        networks: ['Netflix'],
        networkIds: [213],
      }),
    );
    fixture.componentRef.setInput('mediaType', 'tv_show');
    fixture.detectChanges();

    const networkLink = Array.from(fixture.nativeElement.querySelectorAll('a')).find((a) =>
      (a as HTMLAnchorElement).textContent?.includes('Netflix'),
    ) as HTMLAnchorElement | undefined;

    expect(networkLink?.getAttribute('href')).toBe('/networks/213');
  });

  it('hides the original title row when it matches the title', () => {
    const fixture = TestBed.createComponent(MediaDetailMetadataComponent);
    fixture.componentRef.setInput(
      'view',
      view({ title: 'Dune', originalTitle: 'Dune', director: 'D. Villeneuve', directorId: 1 }),
    );
    fixture.componentRef.setInput('mediaType', 'movie');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('media.original_title');
  });
});
