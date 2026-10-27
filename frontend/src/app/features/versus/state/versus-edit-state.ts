import { MAX_DESCRIPTION, MAX_NAME } from '../../lists/state/list-edit-state';
import { computed, DestroyRef, inject, signal, type WritableSignal } from '@angular/core';
import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import type { SearchResult } from '@app/core/services/search/search.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { VersusService } from '@app/core/services/versus/versus';
import type {
  AddVersusClipRequest,
  UpdateVersusClipRequest,
  VersusEntry,
  VersusPoolResponse,
} from '@app/core/services/versus/versus.model';
import { createDetailsSync } from '@shared/utils/details-sync';
import { createEditQueue } from '@shared/utils/edit-queue';
import { createItemRemoval } from '@shared/utils/item-removal';
import { createSelectionState } from '@shared/utils/selection-state';

export const MIN_VERSUS_ENTRIES = 4;

type PoolSignal = WritableSignal<VersusPoolResponse | null>;

interface Deps {
  versus: VersusService;
  toast: ToastService;
  translate: TranslateService;
  toastError: (error: unknown) => void;
}

export function createVersusEditState(pool: PoolSignal) {
  const toast = inject(ToastService);
  const errorMessage = inject(ErrorMessageService);
  const deps: Deps = {
    versus: inject(VersusService),
    toast,
    translate: inject(TranslateService),
    toastError: (error) => toast.error(errorMessage.fromApiError(error)),
  };
  const selection = createSelectionState();
  const items = createVersusItems(pool, deps, selection);
  const details = createVersusDetails(pool, deps, () => {
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
    entries: items.entries,
    enoughEntries: computed(() => items.entries().length >= MIN_VERSUS_ENTRIES),
    kind: items.kind,
    showAuthors: items.showAuthors,
    addMedia: items.addMedia,
    addClip: items.addClip,
    updateClip: items.updateClip,
    remove: items.remove,
    publish: (visibility: CollectionVisibility) => details.sync.save(visibility),
    ...selection,
    flush,
    hasUnsaved: details.sync.hasUnsaved,
  };
}

function createVersusDetails(pool: PoolSignal, deps: Deps, onSwitch: () => void) {
  const name = signal('');
  const description = signal('');
  const nameValid = computed(() => name().trim().length > 0);
  const sync = createDetailsSync<VersusPoolResponse>({
    target: pool,
    local: computed(() => JSON.stringify([name().trim(), description().trim()])),
    valid: nameValid,
    server: (current) => JSON.stringify([current.name, current.description ?? '']),
    apply: (current) => {
      name.set(current.name);
      description.set(current.description ?? '');
    },
    canSave: (current) => current.isOwner,
    request: (current, visibility) =>
      deps.versus.updatePool(current.id, {
        name: name().trim().slice(0, MAX_NAME),
        description: description().trim().slice(0, MAX_DESCRIPTION) || undefined,
        visibility: visibility ?? current.visibility,
      }),
    merge: (latest, updated) => {
      const { name: n, description: d, visibility: v, updatedAt } = updated;
      return latest ? { ...latest, name: n, description: d, visibility: v, updatedAt } : updated;
    },
    onSwitch,
    onError: deps.toastError,
  });
  return { sync, fields: { name, description, nameValid } };
}

function createVersusItems(
  pool: PoolSignal,
  { versus, toast, translate, toastError }: Deps,
  selection: ReturnType<typeof createSelectionState>,
) {
  const { run, busy } = createEditQueue(pool, toastError);
  const { removal, remove } = createItemRemoval({
    target: pool,
    run,
    send: (id, ids) => versus.removeItems(id, ids),
    selection,
    toast,
    translate,
    toastError,
    titleOf: (ids) => pool()?.entries.find((entry) => ids.has(entry.id))?.title ?? '',
    messages: {
      one: 'lists.manage.removed_title',
      many: 'versus.manage.removed_many',
      confirmOne: 'versus.manage.confirm_remove_one',
      confirmMany: 'versus.manage.confirm_remove_many',
    },
  });

  const entries = computed<VersusEntry[]>(() => {
    const gone = removal.hidden();
    return (pool()?.entries ?? []).filter((entry) => !gone.has(entry.id));
  });
  const kind = computed<'media' | 'clips' | null>(() => {
    const first = entries()[0];
    return first ? (first.clip ? 'clips' : 'media') : null;
  });
  const showAuthors = computed(() => {
    const current = pool();
    if (!current) return false;
    const authors = new Set(current.entries.map((entry) => entry.addedBy?.userId).filter(Boolean));
    return authors.size > 1 || current.collaborators.length > 0;
  });

  function addMedia(results: readonly SearchResult[]): void {
    const current = pool();
    if (!current || results.length === 0) return;
    removal.flush();
    const refs = results.map(({ provider, mediaType, externalId }) => ({
      provider,
      mediaType,
      externalId,
    }));
    run(() => versus.addItems(current.id, refs));
  }

  function addClip(request: AddVersusClipRequest): void {
    const current = pool();
    if (!current) return;
    removal.flush();
    run(() => versus.addClip(current.id, request));
  }

  function updateClip(entryId: string, request: UpdateVersusClipRequest): void {
    const current = pool();
    if (current) run(() => versus.updateClip(current.id, entryId, request));
  }

  return { busy, removal, entries, kind, showAuthors, addMedia, addClip, updateClip, remove };
}
