import type { ActivatedRoute, Router } from '@angular/router';
import type { CollectionVisibility } from '@app/core/services/auth/auth.model';

interface SharedCreation {
  collaborators: unknown[];
  pendingInvites: unknown[];
  viewerCollaboratorStatus: string | null;
}

export function isSharedCreation(creation: SharedCreation | null | undefined): boolean {
  return (
    !!creation &&
    (creation.collaborators.length > 0 ||
      creation.pendingInvites.length > 0 ||
      creation.viewerCollaboratorStatus !== null)
  );
}

export function creationVisibilityInfo(
  visibility: CollectionVisibility | undefined,
  shared = false,
) {
  switch (visibility) {
    case 'link':
      return { icon: 'link' as const, labelKey: 'lists.link' };
    case 'private':
      return {
        icon: 'eyeClosed' as const,
        labelKey: shared ? 'lists.private_shared' : 'lists.private',
      };
    default:
      return { icon: 'eye' as const, labelKey: 'lists.public' };
  }
}

export function focusCreationTitle(host: HTMLElement): void {
  const field = host.querySelector<HTMLTextAreaElement>('[data-creation-title]');
  if (!field || document.activeElement === field) return;
  field.focus();
  field.select();
}

export function dropLegacyEditParam(route: ActivatedRoute, router: Router): void {
  if (!route.snapshot.queryParamMap.has('edit')) return;
  void router.navigate([], {
    relativeTo: route,
    queryParams: { edit: null },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}
