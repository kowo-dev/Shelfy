import { computed, DestroyRef, inject, signal, type WritableSignal } from '@angular/core';
import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import type { MediaResponse } from '@app/core/services/collection/collection.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ListsService } from '@app/core/services/lists/lists';
import type { MediaListResponse } from '@app/core/services/lists/lists.model';
import type { SearchResult } from '@app/core/services/search/search.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { createDetailsSync } from '@shared/utils/details-sync';
import { createEditQueue } from '@shared/utils/edit-queue';
import { createItemRemoval } from '@shared/utils/item-removal';
import { moveBlock, type MoveTarget } from '@shared/utils/move-block.util';
import { createSelectionState } from '@shared/utils/selection-state';

export const MAX_TAGS = 20;
export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 280;
export const MAX_TAG = 24;

type ListSignal = WritableSignal<MediaListResponse | null>;

interface Deps {
  lists: ListsService;
  toast: ToastService;
  translate: TranslateService;
  toastError: (error: unknown) => void;
}

export function createListEditState(list: ListSignal) {
  const toast = inject(ToastService);
  const errorMessage = inject(ErrorMessageService);
  const deps: Deps = {
    lists: inject(ListsService),
    toast,
    translate: inject(TranslateService),
    toastError: (error) => toast.error(errorMessage.fromApiError(error)),
  };
  const selection = createSelectionState();
  const items = createListItems(list, deps, selection);
  const details = createListDetails(list, deps, () => {
    items.removal.reset();
    selection.exitSelection();
  });

  function flush(): void {
    items.removal.flush();
    details.sync.flush();
  }
  inject(DestroyRef).onDestroy(flush);

  return {
    ...details.fields,
    detailsState: details.sync.state,
    saving: computed(() => items.busy() > 0 || details.sync.state() === 'saving'),
    media: items.media,
    addedBy: items.addedBy,
    add: items.add,
    remove: items.remove,
    move: items.move,
    publish: (visibility: CollectionVisibility) => details.sync.save(visibility),
    ...selection,
    flush,
    hasUnsaved: details.sync.hasUnsaved,
  };
}

function createListDetails(list: ListSignal, deps: Deps, onSwitch: () => void) {
  const name = signal('');
  const description = signal('');
  const tags = signal<string[]>([]);
  const nameValid = computed(() => name().trim().length > 0);
  const sync = createDetailsSync<MediaListResponse>({
    target: list,
    local: computed(() => JSON.stringify([name().trim(), description().trim(), tags()])),
    valid: nameValid,
    server: (current) => JSON.stringify([current.name, current.description ?? '', current.tags]),
    apply: (current) => {
      name.set(current.name);
      description.set(current.description ?? '');
      tags.set(current.tags);
    },
    canSave: () => true,
    request: (current, visibility) =>
      deps.lists.updateDetails(current.id, {
        name: name().trim().slice(0, MAX_NAME),
        description: description().trim().slice(0, MAX_DESCRIPTION) || undefined,
        visibility: visibility ?? current.visibility,
        tags: tags().map((tag) => tag.slice(0, MAX_TAG)),
      }),
    merge: (latest, updated) =>
      latest ? { ...latest, ...pickDetails(updated), updatedAt: updated.updatedAt } : updated,
    onSwitch,
    onError: deps.toastError,
  });

  function addTag(raw: string): boolean {
    const tag = raw.trim();
    if (!tag || tag.length > MAX_TAG || tags().includes(tag) || tags().length >= MAX_TAGS)
      return false;
    tags.update((current) => [...current, tag]);
    return true;
  }

  const removeTag = (tag: string) => tags.update((current) => current.filter((t) => t !== tag));

  return { sync, fields: { name, description, tags, nameValid, addTag, removeTag } };
}

function createListItems(
  list: ListSignal,
  { lists, toast, translate, toastError }: Deps,
  selection: ReturnType<typeof createSelectionState>,
) {
  const { run, busy } = createEditQueue(list, toastError);
  const { removal, remove } = createItemRemoval({
    target: list,
    run,
    send: (id, ids) => lists.removeItems(id, ids),
    selection,
    toast,
    translate,
    toastError,
    titleOf: (ids) => list()?.media.find((item) => ids.has(item.id))?.title ?? '',
    messages: {
      one: 'lists.manage.removed_title',
      many: 'lists.manage.removed_titles',
      confirmOne: 'lists.manage.confirm_remove_one',
      confirmMany: 'lists.manage.confirm_remove_many',
    },
  });

  const media = computed<MediaResponse[]>(() => {
    const gone = removal.hidden();
    return (list()?.media ?? []).filter((item) => !gone.has(item.id));
  });
  const addedBy = computed(() => {
    const byMedia = new Map((list()?.items ?? []).map((item) => [item.mediaId, item.addedBy]));
    return (mediaId: string) => byMedia.get(mediaId) ?? null;
  });

  function add(results: readonly SearchResult[]): void {
    const current = list();
    if (!current || results.length === 0) return;
    removal.flush();
    const references = results.map(({ provider, mediaType, externalId }) => ({
      provider,
      mediaType,
      externalId,
    }));
    run(() => lists.addItems(current.id, references));
  }

  function move(mediaIds: readonly string[], target: MoveTarget): void {
    const current = list();
    if (!current || mediaIds.length === 0) return;
    removal.flush();
    const local = planMove(current.media, mediaIds, target);
    if (!local) return;
    list.set(reordered(current, local));
    run(
      () => {
        const latest = list()!;
        const next = planMove(latest.media, mediaIds, target) ?? latest.media;
        return lists.reorder(
          latest.id,
          next.map((item) => item.id),
        );
      },
      (error) => {
        toastError(error);
        const latest = list();
        if (latest) run(() => lists.get(latest.id));
      },
    );
  }

  return { busy, removal, media, addedBy, add, remove, move };
}

export function planMove(
  items: readonly MediaResponse[],
  mediaIds: readonly string[],
  target: MoveTarget,
): MediaResponse[] | null {
  const ids = new Set(mediaIds);
  const moving = items.flatMap((item, i) => (ids.has(item.id) ? [i] : []));
  if (moving.length === 0) return null;
  const order = moveBlock(items.length, moving, target);
  return order.every((old, i) => old === i) ? null : order.map((i) => items[i]);
}

function reordered(list: MediaListResponse, media: MediaResponse[]): MediaListResponse {
  const byMedia = new Map(list.items.map((item) => [item.mediaId, item]));
  return {
    ...list,
    media,
    items: media.map((item) => byMedia.get(item.id) ?? { mediaId: item.id, addedBy: null }),
  };
}

function pickDetails(list: MediaListResponse) {
  const { name, description, visibility, tags } = list;
  return { name, description, visibility, tags };
}
