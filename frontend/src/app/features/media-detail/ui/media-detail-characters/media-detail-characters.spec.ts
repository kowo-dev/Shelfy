import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@app/core/services/translate/translate';
import type { AniListCharacter } from '@app/core/services/anilist/anilist.model';

import { MediaDetailCharactersComponent } from './media-detail-characters';

function character(overrides: Partial<AniListCharacter> = {}): AniListCharacter {
  return {
    characterId: 1,
    name: 'Frieren',
    imageUrl: null,
    role: 'MAIN',
    voiceActorId: null,
    japaneseVoiceActor: null,
    ...overrides,
  };
}

describe('MediaDetailCharactersComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaDetailCharactersComponent],
      providers: [
        provideRouter([]),
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  it('renders nothing when both lists are empty', () => {
    const fixture = TestBed.createComponent(MediaDetailCharactersComponent);
    fixture.componentRef.setInput('animeCharacters', []);
    fixture.componentRef.setInput('mangaCharacters', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('prefers anime characters over manga characters when both are present', () => {
    const fixture = TestBed.createComponent(MediaDetailCharactersComponent);
    fixture.componentRef.setInput('animeCharacters', [character({ name: 'Frieren' })]);
    fixture.componentRef.setInput('mangaCharacters', [character({ name: 'Denji' })]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Frieren');
    expect(fixture.nativeElement.textContent).not.toContain('Denji');
  });

  it('falls back to manga characters when anime characters is empty', () => {
    const fixture = TestBed.createComponent(MediaDetailCharactersComponent);
    fixture.componentRef.setInput('animeCharacters', []);
    fixture.componentRef.setInput('mangaCharacters', [character({ name: 'Denji' })]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Denji');
  });

  it('links the japanese voice actor to the staff route when present', () => {
    const fixture = TestBed.createComponent(MediaDetailCharactersComponent);
    fixture.componentRef.setInput('animeCharacters', [
      character({ voiceActorId: 7, japaneseVoiceActor: 'A. Sasa' }),
    ]);
    fixture.componentRef.setInput('mangaCharacters', []);
    fixture.detectChanges();

    const staffLink = fixture.nativeElement.querySelector(
      'a[href^="/staff/"]',
    ) as HTMLAnchorElement | null;

    expect(staffLink?.getAttribute('href')).toBe('/staff/7');
    expect(staffLink?.textContent).toContain('A. Sasa');
  });
});
