import { Routes } from '@angular/router';
import { NAV_OVERLAY } from '@app/core/services/layout/layout';
const entityPage = () => import('./entity-page').then((m) => m.EntityPageComponent);
const browsePage = () => import('./browse/browse').then((m) => m.BrowsePageComponent);

export const ENTITY_ROUTES: Routes = [
  {
    path: 'people/:id',
    loadComponent: entityPage,
    data: { entityKind: 'people', ...NAV_OVERLAY },
  },
  {
    path: 'staff/:id',
    loadComponent: entityPage,
    data: { entityKind: 'staff', ...NAV_OVERLAY },
  },
  {
    path: 'characters/:id',
    loadComponent: entityPage,
    data: { entityKind: 'characters', ...NAV_OVERLAY },
  },
  {
    path: 'companies/:id',
    loadComponent: entityPage,
    data: { entityKind: 'companies', ...NAV_OVERLAY },
  },
  {
    path: 'networks/:id',
    loadComponent: entityPage,
    data: { entityKind: 'networks', ...NAV_OVERLAY },
  },
  {
    path: 'studios/:id',
    loadComponent: entityPage,
    data: { entityKind: 'studios', ...NAV_OVERLAY },
  },
  {
    path: 'game-companies/:id',
    loadComponent: entityPage,
    data: { entityKind: 'game-companies', ...NAV_OVERLAY },
  },
  {
    path: 'franchises/:id',
    loadComponent: entityPage,
    data: { entityKind: 'franchises', ...NAV_OVERLAY },
  },
  {
    path: 'browse/:mediaType/:facet/:ref',
    loadComponent: browsePage,
  },
  {
    path: 'browse/:mediaType/:facet',
    loadComponent: browsePage,
  },
  {
    path: 'browse/:mediaType',
    loadComponent: browsePage,
  },
];
