import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { VersusClip } from '@app/core/services/versus/versus.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { ClipPlaybackService } from './clip-playback';
import {
  clipEmbedUrl,
  clipPlayerCommands,
  playerVolume,
  reportedState,
  reportedVolume,
} from './clip-embed.util';

const HOVER_DELAY_MS = 250;
const SETUP_EVERY_MS = 400;
const START_FALLBACK_MS = 1200;
const FADE_IN_MS = 700;
const FADE_OUT_MS = 400;
const FADE_STEP_MS = 50;

interface PlayerSession {
  heard: boolean;
  started: boolean;
  played: boolean;
}

@Component({
  selector: 'shelfy-clip-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent],
  template: `
    @if (src(); as url) {
      <iframe
        [src]="url"
        [title]="clip().title"
        class="duration-slow absolute top-1/2 left-1/2 aspect-video h-full w-auto max-w-none -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity"
        [class.opacity-0]="!loaded() || (!native() && (!visual() || !playing()))"
        [class.pointer-events-none]="!tappable()"
        [class.pointer-events-auto]="tappable()"
        allow="autoplay; encrypted-media; fullscreen"
        referrerpolicy="strict-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        (load)="onLoad($event)"
      ></iframe>
    }
    @if (button()) {
      <button
        type="button"
        class="cover-play pointer-events-auto"
        [class.is-on]="playing()"
        [attr.aria-label]="(playing() ? 'versus.clip.stop' : 'versus.clip.play') | translate"
        [attr.aria-pressed]="playing()"
        (click)="toggle($event)"
      >
        <shelfy-icon [name]="playing() ? 'pause' : 'play'" size="18" [active]="true" />
      </button>
    }
  `,
  host: {
    class: 'absolute inset-0 block overflow-hidden rounded-[inherit]',
    '[class.pointer-events-none]': '!area()',
    '[class.cursor-pointer]': 'area()',
    '(click)': 'area() && toggle($event)',
  },
})
export class ClipPlayerComponent {
  private readonly playback = inject(ClipPlaybackService);
  private readonly sanitizer = inject(DomSanitizer);

  key = input.required<string>();
  clip = input.required<VersusClip>();
  area = input(true);
  hoverPlay = input(false);
  hovered = input(false);
  button = input(true);
  visual = input(true);
  preload = input(false);
  native = input(false);

  protected readonly loaded = signal(false);
  protected readonly touch = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  protected readonly playing = computed(() => this.playback.active() === this.key());
  protected readonly preloaded = computed(() => this.touch && this.preload());
  protected readonly tappable = computed(
    () => this.native() || (this.touch && (this.preloaded() ? !this.playing() : this.playing())),
  );
  protected readonly showing = signal(false);
  protected readonly src = computed(() => {
    if (this.native()) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(
        clipEmbedUrl(this.clip(), false, undefined, false, true),
      );
    }
    if (this.preloaded()) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(
        clipEmbedUrl(this.clip(), false, undefined, false),
      );
    }
    if (!this.showing()) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      clipEmbedUrl(this.clip(), !this.playback.soundAllowed()),
    );
  });

  private setup: (() => void) | null = null;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private send: ((message: string) => void) | null = null;
  private level = 0;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private readonly targetVolume = computed(() =>
    this.playback.muted() && !this.touch ? 0 : playerVolume(this.playback.volume()),
  );

  constructor() {
    effect(() => {
      const target = this.targetVolume();
      untracked(() => {
        if (this.playing() && !this.fadeTimer) this.setLevel(target);
      });
    });
    this.bindHover();
    this.bindPlaying();
    effect(() => {
      this.src();
      untracked(() => {
        this.loaded.set(false);
        this.setup?.();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.hoverTimer) clearTimeout(this.hoverTimer);
      this.setup?.();
      this.playback.stop(this.key());
    });
  }

  private bindHover(): void {
    effect(() => {
      const hovered = this.hovered();
      if (!this.hoverPlay()) return;
      untracked(() => {
        if (this.hoverTimer) clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
        if (hovered) {
          this.hoverTimer = setTimeout(() => this.playback.play(this.key()), HOVER_DELAY_MS);
        } else {
          this.playback.stop(this.key());
        }
      });
    });
  }

  private bindPlaying(): void {
    effect(() => {
      const playing = this.playing();
      untracked(() => {
        if (this.native()) {
          if (!playing) this.pause();
          return;
        }
        if (playing) {
          this.showing.set(true);
          if (this.send) this.fadeTo(this.targetVolume(), FADE_IN_MS);
        } else if (this.showing()) {
          if (this.send) this.fadeTo(0, FADE_OUT_MS, () => this.pause());
          else this.showing.set(false);
        }
      });
    });
  }

  protected onLoad(event: Event): void {
    this.loaded.set(true);
    const frame = (event.target as HTMLIFrameElement).contentWindow;
    if (frame) this.connect(frame);
  }

  private connect(frame: Window): void {
    const { origin, handshake } = clipPlayerCommands(0);
    const send = (message: string) => frame.postMessage(message, origin);
    const native = this.native();
    this.setup?.();
    this.send = send;
    this.level = native ? this.targetVolume() : 0;
    const session = { heard: false, started: false, played: false };
    const start = () => this.startPlayback(session, send, native);
    const onMessage = (message: MessageEvent) =>
      this.onPlayerMessage(message, frame, session, send, native, start);
    globalThis.addEventListener('message', onMessage);
    const beat = () => {
      if (!session.heard) send(handshake);
      if (!(native && session.started)) send(this.volumeMessage(this.level));
    };
    beat();
    const timer = setInterval(beat, SETUP_EVERY_MS);
    const fallback = setTimeout(start, START_FALLBACK_MS);
    this.setup = () => {
      this.send = null;
      this.stopFade();
      clearInterval(timer);
      clearTimeout(fallback);
      globalThis.removeEventListener('message', onMessage);
      this.setup = null;
      if (!this.playing()) this.showing.set(false);
    };
  }

  private startPlayback(session: PlayerSession, send: (message: string) => void, native: boolean) {
    if (session.started) return;
    session.started = true;
    if (this.playing() && !native) {
      clipPlayerCommands(0).play.forEach(send);
      this.fadeTo(this.targetVolume(), FADE_IN_MS);
    }
  }

  private onPlayerMessage(
    message: MessageEvent,
    frame: Window,
    session: PlayerSession,
    send: (message: string) => void,
    native: boolean,
    start: () => void,
  ): void {
    if (message.source !== frame) return;
    session.heard = true;
    const state = reportedState(message.data);
    if (state === 'play') {
      session.played = true;
      this.playback.play(this.key());
    } else if (state === 'pause' && session.played) this.playback.stop(this.key());
    const reported = reportedVolume(message.data);
    if (reported !== null && reported !== this.level && !(native && session.started)) {
      send(this.volumeMessage(this.level));
    }
    if (reported !== null || /ready/i.test(String(message.data))) start();
  }

  private pause(): void {
    clipPlayerCommands(0).pause.forEach((message) => this.send?.(message));
    this.showing.set(false);
  }

  private volumeMessage(level: number): string {
    return clipPlayerCommands(level).volume;
  }

  private setLevel(level: number): void {
    this.level = level;
    this.send?.(this.volumeMessage(level));
  }

  private stopFade(): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.fadeTimer = null;
  }

  private fadeTo(target: number, ms: number, done?: () => void): void {
    this.stopFade();
    const from = this.level;
    const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
    let step = 0;
    this.fadeTimer = setInterval(() => {
      step++;
      this.setLevel(Math.round(from + ((target - from) * step) / steps));
      if (step >= steps) {
        this.stopFade();
        done?.();
      }
    }, FADE_STEP_MS);
  }

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.playback.toggle(this.key());
  }
}
