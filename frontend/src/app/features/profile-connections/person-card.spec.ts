import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@app/core/services/translate/translate';
import type { Connection } from './connections';
import { PersonCardComponent } from './person-card';

describe('PersonCardComponent', () => {
  const person = (overrides: Partial<Connection> = {}): Connection => ({
    key: 'k1',
    userId: 'u1',
    username: 'alice',
    name: 'Alice Archer',
    avatarUrl: null,
    favorite: false,
    bannerUrl: null,
    titleCount: null,
    coverUrls: [],
    ...overrides,
  });

  function render(card: Connection, note: string | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: TranslateService,
          useValue: {
            get: (key: string, params?: { count: number }) =>
              params ? `${key}:${params.count}` : key,
            lang: () => 'en',
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PersonCardComponent);
    fixture.componentRef.setInput('person', card);
    fixture.componentRef.setInput('note', note);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    return {
      root,
      images: Array.from(root.querySelectorAll('img')).map((img) => img.getAttribute('src')),
      fallback: root.querySelector('.bg-profile-fallback'),
      text: root.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  }

  it('shows the banner instead of the recent covers', () => {
    const { images, fallback } = render(
      person({ bannerUrl: 'banner.jpg', coverUrls: ['1.jpg', '2.jpg', '3.jpg'] }),
    );

    expect(images).toEqual(['banner.jpg']);
    expect(fallback).toBeNull();
  });

  it('keeps the grey fallback when there is no banner, even with covers', () => {
    const { images, fallback } = render(person({ coverUrls: ['1.jpg'] }));

    expect(images).toEqual([]);
    expect(fallback).not.toBeNull();
  });

  it('uses the plain fallback when there is neither a banner nor covers', () => {
    const { images, fallback } = render(person());

    expect(images).toEqual([]);
    expect(fallback).not.toBeNull();
  });

  it('shows the avatar when there is one and the initials otherwise', () => {
    expect(render(person({ avatarUrl: 'me.png' })).images).toEqual(['me.png']);

    TestBed.resetTestingModule();

    expect(render(person()).text).toContain('AA');
  });

  it('puts the follower and title counts forward under the handle', () => {
    const { root, text } = render(person({ titleCount: 12, followersCount: 41 }));

    expect(text).toContain('Alice Archer');
    expect(root.querySelector('.person-card-id > span')?.textContent?.trim()).toBe('@alice');
    const stats = Array.from(root.querySelectorAll('.person-card-stats > span')).map((span) =>
      span.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(stats).toEqual([
      '41 community.people.followers_label:41',
      '12 community.people.titles_label:12',
    ]);
  });

  it('shows zero counts but hides the counts when they are not visible', () => {
    expect(render(person({ titleCount: 0, followersCount: 0 })).text).toContain(
      'followers_label:0',
    );

    TestBed.resetTestingModule();
    const { root } = render(person({ titleCount: null, followersCount: null }));

    expect(root.querySelector('.person-card-stats')).toBeNull();
  });

  it('shows the relation note as a tag on the banner', () => {
    const { root } = render(person(), 'community.people.follows_you');

    expect(root.querySelector('.person-card-art .person-card-note')?.textContent).toBe(
      'community.people.follows_you',
    );
  });

  it('opens the profile from the whole card', () => {
    const { root } = render(person());

    expect(root.querySelector('a')?.getAttribute('href')).toBe('/profile/alice');
  });
});
