import { inject, isDevMode } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authRoutes } from './features/auth/auth.routes';
import { authGuard } from './core/guards/auth-guard';
import { TranslateService } from './core/services/translate/translate';
import { guestGuard } from './core/guards/guest-guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes-guard';
import { ENTITY_ROUTES } from './features/entity/entity.routes';
import { VERSUS_ROUTES } from './features/versus/versus.routes';
import { detailMediaRoute } from './features/media-detail/media-route';
import { NAV_OVERLAY } from './core/services/layout/layout';
import {
  communityPeopleGuard,
  communityRedirect,
  editInPlaceRedirect,
  keepQueryRedirect,
  profilePeopleRedirect,
} from './features/community/community-redirect';

const PRELOAD = { preload: true } as const;

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('@shared/layouts').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', redirectTo: 'discover', pathMatch: 'full' },
      {
        path: 'discover',
        data: { ...NAV_OVERLAY, ...PRELOAD },
        loadComponent: () =>
          import('./features/discover/discover').then((m) => m.DiscoverPageComponent),
      },
      {
        path: 'discover/:feed',
        data: NAV_OVERLAY,
        loadComponent: () =>
          import('./features/discover/feed/discover-feed').then((m) => m.DiscoverFeedPageComponent),
      },
      {
        path: 'explore',
        data: { ...NAV_OVERLAY, ...PRELOAD },
        loadComponent: () =>
          import('./features/explore/explore').then((m) => m.ExplorePageComponent),
      },
      {
        path: 'collection',
        data: { ...NAV_OVERLAY, ...PRELOAD },
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/collection/collection').then((m) => m.CollectionPageComponent),
      },
      {
        path: 'bookmarks',
        pathMatch: 'full',
        redirectTo: 'collection',
      },
      {
        path: 'creations',
        data: { ...NAV_OVERLAY, ...PRELOAD },
        canActivate: [communityPeopleGuard],
        loadComponent: () =>
          import('./features/community/community').then((m) => m.CommunityPageComponent),
      },
      {
        path: 'people',
        data: NAV_OVERLAY,
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/profile-connections/profile-connections').then(
            (m) => m.ProfileConnectionsPageComponent,
          ),
      },
      { path: 'community', pathMatch: 'full', redirectTo: keepQueryRedirect('/creations') },
      { path: 'connections', pathMatch: 'full', redirectTo: keepQueryRedirect('/people') },
      { path: 'friends', pathMatch: 'full', redirectTo: '/people' },
      {
        path: 'users/:username',
        data: NAV_OVERLAY,
        loadComponent: () =>
          import('./features/friend-profile/friend-profile').then(
            (m) => m.FriendProfilePageComponent,
          ),
      },
      {
        path: 'friends/:username',
        redirectTo: 'users/:username',
        pathMatch: 'full',
      },
      {
        path: 'media/:mediaType/:externalId',
        data: { ...NAV_OVERLAY, ...PRELOAD },
        canMatch: [detailMediaRoute],
        loadComponent: () =>
          import('./features/media-detail/media-detail').then((m) => m.MediaDetailPageComponent),
      },
      {
        path: 'media/:mediaType/:externalId/episodes',
        data: NAV_OVERLAY,
        canMatch: [detailMediaRoute],
        loadComponent: () =>
          import('./features/media-detail/tracker/tracker-page').then(
            (m) => m.TrackerPageComponent,
          ),
      },
      {
        path: 'media/:mediaType/:externalId/similar',
        data: NAV_OVERLAY,
        canMatch: [detailMediaRoute],
        loadComponent: () =>
          import('./features/media-detail/similar/similar-page').then(
            (m) => m.SimilarPageComponent,
          ),
      },
      {
        path: 'reviews/new',
        data: NAV_OVERLAY,
        canActivate: [authGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/review-detail/review-studio').then((m) => m.ReviewStudioPageComponent),
      },
      {
        path: 'reviews/:id/edit',
        data: NAV_OVERLAY,
        canActivate: [authGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/review-detail/review-studio').then((m) => m.ReviewStudioPageComponent),
      },
      ...['reviews/:id/log', 'reviews/:id/log/:logId'].map((path) => ({
        path,
        data: { ...NAV_OVERLAY, studio: 'log' },
        canActivate: [authGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/review-detail/review-studio').then((m) => m.ReviewStudioPageComponent),
      })),
      {
        path: 'reviews/:id',
        data: NAV_OVERLAY,
        loadComponent: () =>
          import('./features/review-detail/review-detail').then((m) => m.ReviewDetailPageComponent),
      },
      {
        path: 'dev/ui',
        canMatch: [() => isDevMode()],
        loadComponent: () => import('./features/dev-ui/dev-ui').then((m) => m.DevUiPageComponent),
      },
      {
        path: 'dev/media',
        canMatch: [() => isDevMode()],
        loadComponent: () =>
          import('./features/dev-ui/dev-media').then((m) => m.DevMediaPageComponent),
      },
      {
        path: 'dev/connections',
        canMatch: [() => isDevMode()],
        loadComponent: () =>
          import('./features/dev-ui/dev-connections').then((m) => m.DevConnectionsPageComponent),
      },
      {
        path: 'dev/discover',
        canMatch: [() => isDevMode()],
        loadComponent: () =>
          import('./features/dev-ui/dev-discover').then((m) => m.DevDiscoverPageComponent),
      },
      {
        path: 'dev/profile',
        canMatch: [() => isDevMode()],
        loadComponent: () =>
          import('./features/dev-ui/dev-profile').then((m) => m.DevProfilePageComponent),
      },
      ...ENTITY_ROUTES,
      ...VERSUS_ROUTES,
      {
        path: 'legal/privacy-policy',
        data: NAV_OVERLAY,
        loadComponent: () =>
          import('./features/legal/privacy-policy/privacy-policy').then(
            (m) => m.PrivacyPolicyPageComponent,
          ),
      },
      {
        path: 'legal/terms',
        data: NAV_OVERLAY,
        loadComponent: () =>
          import('./features/legal/terms-of-service/terms-of-service').then(
            (m) => m.TermsOfServicePageComponent,
          ),
      },
      {
        path: 'legal/notice',
        data: NAV_OVERLAY,
        loadComponent: () =>
          import('./features/legal/legal-notice/legal-notice').then(
            (m) => m.LegalNoticePageComponent,
          ),
      },
      {
        path: 'admin',
        data: NAV_OVERLAY,
        canActivate: [authGuard],
        loadComponent: () => import('./features/admin/admin').then((m) => m.AdminPageComponent),
      },
      {
        path: 'notifications',
        data: NAV_OVERLAY,
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/notifications/notifications').then(
            (m) => m.NotificationsPageComponent,
          ),
      },
      {
        path: 'settings',
        data: NAV_OVERLAY,
        canActivate: [authGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.SettingsPageComponent),
      },
      {
        path: 'profile',
        data: NAV_OVERLAY,
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/profile/profile').then((m) => m.ProfilePageComponent),
      },
      { path: 'awards', redirectTo: 'profile' },
      {
        path: 'profile/:username/awards',
        redirectTo: ({ params }) => inject(Router).createUrlTree(['/profile', params['username']]),
      },
      {
        path: 'profile/:username/reviews',
        redirectTo: ({ params }) =>
          inject(Router).createUrlTree(['/profile', params['username'], 'lists'], {
            queryParams: { f: 'reviews' },
          }),
      },
      {
        path: 'profile/:username/followers',
        redirectTo: profilePeopleRedirect(),
      },
      {
        path: 'profile/:username/connections',
        data: NAV_OVERLAY,
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/profile-connections/profile-connections').then(
            (m) => m.ProfileConnectionsPageComponent,
          ),
      },
      {
        path: 'profile/:username/lists/:id',
        data: NAV_OVERLAY,
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/lists/list-detail').then((m) => m.ListDetailPageComponent),
      },
      {
        path: 'profile/:username/lists',
        data: NAV_OVERLAY,
        loadComponent: () =>
          import('./features/lists/lists-library').then((m) => m.ListsLibraryPageComponent),
      },
      {
        path: 'me/:kind',
        data: NAV_OVERLAY,
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/lists/lists-library').then((m) => m.ListsLibraryPageComponent),
      },
      {
        path: 'profile/:username',
        data: NAV_OVERLAY,
        loadComponent: () =>
          import('./features/profile/profile').then((m) => m.ProfilePageComponent),
      },
      { path: 'lists', pathMatch: 'full', redirectTo: communityRedirect('lists') },
      { path: 'reviews', pathMatch: 'full', redirectTo: communityRedirect('reviews') },
      {
        path: 'lists/new',
        pathMatch: 'full',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/lists/list-new').then((m) => m.ListNewPageComponent),
      },
      { path: 'lists/:id/edit', redirectTo: editInPlaceRedirect('/lists', 'id') },
      {
        path: 'lists/:id',
        data: NAV_OVERLAY,
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/lists/list-detail').then((m) => m.ListDetailPageComponent),
      },
    ],
  },
  {
    path: 'dev/auth',
    canMatch: [() => isDevMode()],
    loadComponent: () => import('@shared/layouts').then((m) => m.AuthLayoutComponent),
    children: authRoutes,
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('@shared/layouts').then((m) => m.AuthLayoutComponent),
    children: authRoutes,
  },
  {
    path: 'confirm-email-change',
    loadComponent: () => import('@shared/layouts').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/auth/confirm-email-change/confirm-email-change').then(
            (m) => m.ConfirmEmailChangeComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('@shared/layouts').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        title: () => inject(TranslateService).get('not_found.title'),
        loadComponent: () =>
          import('./features/not-found/not-found').then((m) => m.NotFoundPageComponent),
      },
    ],
  },
];
