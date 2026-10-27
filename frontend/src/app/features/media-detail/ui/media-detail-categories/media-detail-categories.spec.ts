import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@app/core/services/translate/translate';

import { MediaDetailCategoriesComponent } from './media-detail-categories';

describe('MediaDetailCategoriesComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaDetailCategoriesComponent],
      providers: [
        provideRouter([]),
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function setInputs(
    fixture: ReturnType<typeof TestBed.createComponent<MediaDetailCategoriesComponent>>,
    overrides: {
      genres?: string[];
      genreIds?: (number | string)[];
      tags?: string[];
      tagRefs?: (number | string)[];
      mediaType?: string;
    },
  ): void {
    fixture.componentRef.setInput('genres', overrides.genres ?? []);
    fixture.componentRef.setInput('genreIds', overrides.genreIds ?? []);
    fixture.componentRef.setInput('tags', overrides.tags ?? []);
    fixture.componentRef.setInput('tagRefs', overrides.tagRefs ?? []);
    fixture.componentRef.setInput('mediaType', overrides.mediaType ?? 'movie');
  }

  it('renders nothing when there are no genres and no tags', () => {
    const fixture = TestBed.createComponent(MediaDetailCategoriesComponent);
    setInputs(fixture, {});
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('links a genre to its browse route with a query param fallback to its name', () => {
    const fixture = TestBed.createComponent(MediaDetailCategoriesComponent);
    setInputs(fixture, { genres: ['Sci-Fi'], genreIds: [12], mediaType: 'movie' });
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/browse/movie/genre/12?name=Sci-Fi');
  });

  it('falls back to the genre name in the route when no id is available', () => {
    const fixture = TestBed.createComponent(MediaDetailCategoriesComponent);
    setInputs(fixture, { genres: ['Action'], genreIds: [], mediaType: 'anime' });
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/browse/anime/genre/Action?name=Action');
  });

  it('links a tag to its browse route using the tag ref', () => {
    const fixture = TestBed.createComponent(MediaDetailCategoriesComponent);
    setInputs(fixture, { tags: ['Isekai'], tagRefs: [42], mediaType: 'anime' });
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/browse/anime/tag/42');
  });
});
