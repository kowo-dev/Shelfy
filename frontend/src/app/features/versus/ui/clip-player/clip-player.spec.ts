import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';
import type { VersusClip } from '@app/core/services/versus/versus.model';

import { ClipPlayerComponent } from './clip-player';
import { ClipPlaybackService } from './clip-playback';
import {
  clipEmbedUrl,
  clipPlayerCommands,
  playerVolume,
  reportedState,
  reportedVolume,
} from './clip-embed.util';

const YOUTUBE: VersusClip = {
  provider: 'youtube',
  externalId: 'dQw4w9WgXcQ',
  title: 'Song',
  author: 'Artist',
  startSeconds: 30,
};

describe('ClipPlayerComponent', () => {
  function setup(key = 'e1') {
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { get: (k: string) => k, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(ClipPlayerComponent);
    fixture.componentRef.setInput('key', key);
    fixture.componentRef.setInput('clip', YOUTUBE);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const playback = TestBed.inject(ClipPlaybackService);
    playback.allowSound();
    fixture.detectChanges();
    return { fixture, el, playback };
  }

  it('loads nothing from the provider until it is played', () => {
    const { el } = setup();
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('plays with sound from the button, and stops on a second press', () => {
    const { fixture, el } = setup();
    const button = el.querySelector('button')!;

    button.click();
    fixture.detectChanges();
    const frame = el.querySelector('iframe');
    expect(frame?.getAttribute('src')).toContain(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(frame?.getAttribute('src')).toContain('mute=0');
    expect(frame?.getAttribute('src')).toContain('start=30');
    expect(frame?.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-presentation',
    );
    expect(frame?.getAttribute('referrerpolicy')).toBe('strict-origin');

    button.click();
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('plays and stops from a click anywhere on the poster, unless turned off', () => {
    const { fixture, el } = setup();
    el.click();
    fixture.detectChanges();
    expect(el.querySelector('iframe')).not.toBeNull();
    el.click();
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBeNull();

    fixture.componentRef.setInput('area', false);
    fixture.detectChanges();
    el.click();
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('in hover mode, plays while hovered and stops when left', () => {
    vi.useFakeTimers();
    const { fixture, el } = setup();
    fixture.componentRef.setInput('area', false);
    fixture.componentRef.setInput('hoverPlay', true);
    fixture.componentRef.setInput('hovered', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(el.querySelector('iframe')).not.toBeNull();

    fixture.componentRef.setInput('hovered', false);
    fixture.detectChanges();
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBeNull();
    vi.useRealTimers();
  });

  it('starts muted while the page has had no click, then reloads with sound', () => {
    const { fixture, el, playback } = setup();
    playback.soundAllowed.set(false);
    playback.toggle('e1');
    fixture.detectChanges();
    expect(el.querySelector('iframe')?.getAttribute('src')).toContain('mute=1');

    playback.allowSound();
    fixture.detectChanges();
    expect(el.querySelector('iframe')?.getAttribute('src')).toContain('mute=0');
  });

  it('on touch screens, preloads a paused player that the tap itself starts', () => {
    const matchMedia = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) => ({
      matches: query === '(pointer: coarse)',
    })) as typeof globalThis.matchMedia;
    const { fixture, el, playback } = setup();
    globalThis.matchMedia = matchMedia;
    fixture.componentRef.setInput('area', false);
    fixture.componentRef.setInput('preload', true);
    fixture.detectChanges();

    const frame = el.querySelector('iframe');
    expect(frame?.getAttribute('src')).toContain('autoplay=0&mute=0');
    expect(frame?.classList).toContain('pointer-events-auto');

    playback.play('e1');
    fixture.detectChanges();
    expect(el.querySelector('iframe')?.classList).toContain('pointer-events-none');

    playback.stop('e1');
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBe(frame);
  });

  it('in native mode, loads the YouTube player with its controls at once and pauses it when another clip starts', () => {
    const { fixture, el, playback } = setup();
    fixture.componentRef.setInput('native', true);
    fixture.componentRef.setInput('button', false);
    fixture.detectChanges();
    const frame = el.querySelector('iframe');
    expect(frame?.getAttribute('src')).toContain('controls=1');
    expect(frame?.classList).toContain('pointer-events-auto');
    expect(frame?.getAttribute('allow')).toContain('fullscreen');

    playback.play('e1');
    fixture.detectChanges();
    playback.play('e2');
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBe(frame);
  });

  it('gives way when another clip starts', () => {
    const { fixture, el, playback } = setup();
    playback.toggle('e1');
    fixture.detectChanges();
    expect(el.querySelector('iframe')).not.toBeNull();

    playback.toggle('e2');
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBeNull();
  });
});

describe('clipEmbedUrl', () => {
  it('shows the YouTube controls only when asked', () => {
    expect(clipEmbedUrl(YOUTUBE)).toContain('controls=0');
    expect(clipEmbedUrl(YOUTUBE)).toContain('disablekb=1');
    const native = clipEmbedUrl(YOUTUBE, false, 'https://shelfy.dev', false, true);
    expect(native).toContain('autoplay=0');
    expect(native).toContain('controls=1');
    expect(native).toContain('disablekb=0');
  });

  it('youtube honours the start time (no looping playlist) and accepts commands', () => {
    const url = clipEmbedUrl(YOUTUBE, false, 'https://shelfy.dev');
    expect(url).toContain('start=30');
    expect(url).not.toContain('playlist=');
    expect(url).toContain('enablejsapi=1&origin=https%3A%2F%2Fshelfy.dev');
  });
});

describe('clipPlayerCommands', () => {
  it('talks to YouTube after its handshake and sets a low volume', () => {
    const youtube = clipPlayerCommands(20);
    expect(youtube.handshake).toBe(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
    );
    expect(youtube.volume).toBe(
      JSON.stringify({ event: 'command', func: 'setVolume', args: [20] }),
    );
    expect(youtube.origin).toBe('https://www.youtube-nocookie.com');
  });

  it('reads the volume a player reports', () => {
    expect(reportedVolume(JSON.stringify({ event: 'infoDelivery', info: { volume: 100 } }))).toBe(
      100,
    );
    expect(reportedVolume('{"event":"onReady"}')).toBeNull();
    expect(reportedVolume('not json')).toBeNull();
  });

  it('asks the player to play once ready, as mobile browsers load it paused', () => {
    expect(clipPlayerCommands(20).play).toContain(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
    );
  });

  it('reads whether a player started or stopped on its own', () => {
    expect(reportedState(JSON.stringify({ event: 'infoDelivery', info: { playerState: 1 } }))).toBe(
      'play',
    );
    expect(reportedState(JSON.stringify({ event: 'onStateChange', info: 2 }))).toBe('pause');
    expect(reportedState(JSON.stringify({ event: 'infoDelivery', info: { playerState: 3 } }))).toBe(
      null,
    );
    expect(reportedState(JSON.stringify({ event: 'onStateChange', info: 0 }))).toBe('pause');
    expect(reportedState(JSON.stringify({ method: 'ready' }))).toBeNull();
    expect(reportedState('not json')).toBeNull();
  });

  it('maps the slider on a loudness curve, quiet at the low end', () => {
    expect(playerVolume(0)).toBe(0);
    expect(playerVolume(5)).toBe(1);
    expect(playerVolume(10)).toBe(1);
    expect(playerVolume(50)).toBe(15);
    expect(playerVolume(100)).toBe(60);
  });
});
