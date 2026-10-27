import type { VersusClip } from '@app/core/services/versus/versus.model';

const MAX_PLAYER_VOLUME = 60;
const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com';

export function playerVolume(slider: number): number {
  if (slider <= 0) return 0;
  return Math.max(1, Math.round(MAX_PLAYER_VOLUME * (slider / 100) ** 2));
}

export function clipEmbedUrl(
  clip: VersusClip,
  muted = false,
  origin = globalThis.location?.origin ?? '',
  autoplay = true,
  controls = false,
): string {
  const id = encodeURIComponent(clip.externalId);
  return (
    `${PLAYER_ORIGIN}/embed/${id}?autoplay=${autoplay ? 1 : 0}&mute=${muted ? 1 : 0}` +
    `&controls=${controls ? 1 : 0}&playsinline=1&rel=0&disablekb=${controls ? 0 : 1}` +
    `&start=${clip.startSeconds ?? 0}&enablejsapi=1&origin=${encodeURIComponent(origin)}`
  );
}

export function clipSourceUrl(clip: VersusClip): string {
  return `https://www.youtube.com/watch?v=${clip.externalId}`;
}

export function clipPlayerCommands(volume: number): {
  origin: string;
  handshake: string;
  volume: string;
  play: string[];
  pause: string[];
} {
  return {
    origin: PLAYER_ORIGIN,
    handshake: JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
    volume: JSON.stringify({ event: 'command', func: 'setVolume', args: [volume] }),
    play: [
      JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
    ],
    pause: [JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] })],
  };
}

function parseMessage(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function reportedVolume(data: unknown): number | null {
  const message = parseMessage(data);
  const volume = (message as { info?: { volume?: unknown } } | null)?.info?.volume;
  return typeof volume === 'number' ? volume : null;
}

const YOUTUBE_PLAYING = 1;
const YOUTUBE_STOPPED = new Set([0, 2]);

export function reportedState(data: unknown): 'play' | 'pause' | null {
  const message = parseMessage(data) as { event?: unknown; info?: unknown } | null;
  if (!message || typeof message !== 'object') return null;
  const youtube =
    message.event === 'onStateChange'
      ? message.info
      : message.event === 'infoDelivery'
        ? (message.info as { playerState?: unknown } | null)?.playerState
        : undefined;
  if (typeof youtube !== 'number') return null;
  if (youtube === YOUTUBE_PLAYING) return 'play';
  return YOUTUBE_STOPPED.has(youtube) ? 'pause' : null;
}
