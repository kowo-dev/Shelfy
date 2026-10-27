import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';
import type { MediaResponse } from '@app/core/services/collection/collection.model';
import type { VersusEntry } from '@app/core/services/versus/versus.model';

import { VersusMatchupComponent } from './versus-matchup';

function media(overrides: Partial<MediaResponse> = {}): VersusEntry {
  const m: MediaResponse = {
    id: 'm1',
    canonicalWorkId: 'cw1',
    externalId: '1',
    provider: 'tmdb',
    mediaType: 'movie',
    title: 'Movie 1',
    coverUrl: null,
    metadata: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
  return { id: m.id, title: m.title, coverUrl: m.coverUrl, media: m, clip: null };
}

describe('VersusMatchupComponent', () => {
  function setup(mediaA: VersusEntry | null, mediaB: VersusEntry | null, disabled = false) {
    TestBed.configureTestingModule({
      imports: [VersusMatchupComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(VersusMatchupComponent);
    fixture.componentRef.setInput('entryA', mediaA);
    fixture.componentRef.setInput('entryB', mediaB);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.detectChanges();
    return fixture;
  }

  it('emits picked with the media id when clicked', () => {
    const fixture = setup(media({ id: 'a' }), media({ id: 'b' }));
    const component = fixture.componentInstance;
    let picked: string | undefined;
    component.picked.subscribe((id) => (picked = id));

    component.pick(media({ id: 'a' }));

    expect(picked).toBe('a');
  });

  it('does not emit when disabled', () => {
    const fixture = setup(media({ id: 'a' }), media({ id: 'b' }), true);
    const component = fixture.componentInstance;
    let picked: string | undefined;
    component.picked.subscribe((id) => (picked = id));

    component.pick(media({ id: 'a' }));

    expect(picked).toBeUndefined();
  });

  it('picks the left or right cover from the arrow keys', () => {
    const fixture = setup(media({ id: 'a' }), media({ id: 'b' }));
    const picks: string[] = [];
    fixture.componentInstance.picked.subscribe((id) => picks.push(id));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));

    expect(picks).toEqual(['a']);
  });

  it('ignores arrow keys with a modifier, and when disabled', () => {
    const fixture = setup(media({ id: 'a' }), media({ id: 'b' }), true);
    const picks: string[] = [];
    fixture.componentInstance.picked.subscribe((id) => picks.push(id));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true }));

    expect(picks).toEqual([]);
  });

  it('reports the focused cover so the page can take its colour', () => {
    const fixture = setup(media({ id: 'a' }), media({ id: 'b' }));
    const seen: (string | null)[] = [];
    fixture.componentInstance.focused.subscribe((m) => seen.push(m?.id ?? null));
    const frame = (fixture.nativeElement as HTMLElement).querySelectorAll('article')[1];

    frame.dispatchEvent(new Event('pointerenter'));
    frame.dispatchEvent(new Event('pointerleave'));

    expect(seen).toEqual(['b', null]);
  });

  it('does not emit for a null media (bye slot)', () => {
    const fixture = setup(media({ id: 'a' }), null);
    const component = fixture.componentInstance;
    let picked: string | undefined;
    component.picked.subscribe((id) => (picked = id));

    component.pick(null);

    expect(picked).toBeUndefined();
  });

  it('plays a clip in the YouTube player itself, with its own controls', () => {
    const clip: VersusEntry = {
      ...media({ id: 'c' }),
      media: null,
      clip: {
        provider: 'youtube',
        externalId: 'dQw4w9WgXcQ',
        title: 'Song',
        author: 'Artist',
        startSeconds: null,
      },
    };
    const fixture = setup(clip, media({ id: 'b' }));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('iframe')?.getAttribute('src')).toContain('controls=1');
    expect(el.querySelector('button[aria-label="versus.clip.play"]')).toBeNull();
    expect(el.textContent).toContain('versus.clip.video');
  });

  it('lays a duel with a clip out as video frames, and a poster duel as posters', () => {
    const clip: VersusEntry = {
      ...media({ id: 'c' }),
      clip: {
        provider: 'youtube',
        externalId: 'x',
        title: 'Song',
        author: null,
        startSeconds: null,
      },
    };
    const withClip = setup(clip, media({ id: 'b' }));
    const el = withClip.nativeElement as HTMLElement;
    expect(el.querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('video');
    expect(el.querySelector('.aspect-video')).not.toBeNull();

    TestBed.resetTestingModule();
    const posters = setup(media({ id: 'a' }), media({ id: 'b' }));
    expect(
      (posters.nativeElement as HTMLElement)
        .querySelector('[data-mode]')
        ?.getAttribute('data-mode'),
    ).toBe('image');
  });

  it('picks from the button under each card', () => {
    const fixture = setup(media({ id: 'a' }), media({ id: 'b' }));
    const picks: string[] = [];
    fixture.componentInstance.picked.subscribe((id) => picks.push(id));
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'button[aria-label="versus.play.choose_title"]',
    );

    buttons[buttons.length - 1].click();

    expect(picks).toEqual(['b']);
  });
});
