import { Routes } from '@angular/router';
import { communityRedirect, editInPlaceRedirect } from '@app/features/community/community-redirect';
import { authGuard } from '@app/core/guards/auth-guard';
import { unsavedChangesGuard } from '@app/core/guards/unsaved-changes-guard';
import { NAV_OVERLAY } from '@app/core/services/layout/layout';

export const VERSUS_ROUTES: Routes = [
  { path: 'versus', pathMatch: 'full', redirectTo: communityRedirect('versus') },
  {
    path: 'versus/new',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () => import('./versus-new').then((m) => m.VersusNewPageComponent),
  },
  { path: 'versus/:poolId/edit', redirectTo: editInPlaceRedirect('/versus', 'poolId') },
  {
    path: 'versus/:poolId',
    data: NAV_OVERLAY,
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./versus-pool-detail/versus-pool-detail').then(
        (m) => m.VersusPoolDetailPageComponent,
      ),
  },
  {
    path: 'versus/:poolId/results/:sessionId',
    data: NAV_OVERLAY,
    loadComponent: () =>
      import('./versus-result/versus-result').then((m) => m.VersusResultPageComponent),
  },
  {
    path: 'versus/:poolId/play/:sessionId',
    canActivate: [authGuard],
    data: { keepAlive: false },
    loadComponent: () => import('./versus-play/versus-play').then((m) => m.VersusPlayPageComponent),
  },
];
