import type { MediaType, UserMediaStatus } from '@app/core/services/collection/collection.model';
import type { IconName } from '@shared/ui/icon/icon-registry';

export const COLLECTION_STATUSES: UserMediaStatus[] = ['planned', 'ongoing', 'done', 'dropped'];

export const SHELF_STATUSES: UserMediaStatus[] = COLLECTION_STATUSES.filter(
  (status) => status !== 'planned',
);

export const PROGRESS_STATUSES = SHELF_STATUSES;

export function countsForStatuses(
  byType: Partial<Record<MediaType, Partial<Record<UserMediaStatus, number>>>>,
  statuses: readonly UserMediaStatus[],
): Partial<Record<MediaType, number>> {
  return Object.fromEntries(
    Object.entries(byType).map(([type, counts]) => [
      type,
      statuses.reduce((sum, status) => sum + (counts?.[status] ?? 0), 0),
    ]),
  );
}

type DoneVerb = 'watched' | 'read' | 'played';

const DONE_VERB: Record<MediaType, DoneVerb> = {
  movie: 'watched',
  tv_show: 'watched',
  anime: 'watched',
  book: 'read',
  manga: 'read',
  webtoon: 'read',
  game: 'played',
};

export function doneVerb(mediaType: MediaType): DoneVerb {
  return DONE_VERB[mediaType] ?? 'watched';
}

export function statusLabelKey(status: UserMediaStatus, mediaType?: string | null): string {
  const verb = status === 'done' && mediaType ? DONE_VERB[mediaType as MediaType] : undefined;
  return verb ? `collection.status_done.${verb}` : `collection.status.${status}`;
}

const STATUS_COLOR_VARS: Record<UserMediaStatus, string> = {
  planned: '--color-status-planned',
  ongoing: '--color-status-ongoing',
  done: '--color-status-done',
  dropped: '--color-status-dropped',
};

const STATUS_ICON_MAP: Record<UserMediaStatus, IconName> = {
  planned: 'statusPlanned',
  ongoing: 'statusOngoing',
  done: 'statusDone',
  dropped: 'statusDropped',
};

export function collectionStatusColor(status: UserMediaStatus): string {
  return `var(${STATUS_COLOR_VARS[status]})`;
}

export function collectionStatusIcon(status: UserMediaStatus): string {
  return STATUS_ICON_MAP[status];
}
