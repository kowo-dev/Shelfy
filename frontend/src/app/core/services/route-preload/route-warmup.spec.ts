import { Component } from '@angular/core';
import type { Routes } from '@angular/router';
import { vi } from 'vitest';
import { warmRoute } from './route-warmup';

@Component({ template: '' })
class PageComponent {}

describe('warmRoute', () => {
  function setup() {
    const loader = () => vi.fn(() => Promise.resolve(PageComponent));
    const layout = loader();
    const discover = loader();
    const media = loader();
    const tracker = loader();
    const auth = loader();
    const routes: Routes = [
      {
        path: '',
        loadComponent: layout,
        children: [
          { path: '', redirectTo: 'discover', pathMatch: 'full' },
          { path: 'discover', loadComponent: discover },
          { path: 'media/:mediaType/:externalId', loadComponent: media },
          { path: 'media/:mediaType/:externalId/episodes', loadComponent: tracker },
        ],
      },
      { path: 'auth', loadComponent: auth },
      { path: '**', redirectTo: '' },
    ];
    return { routes, layout, discover, media, tracker, auth };
  }

  it('loads the layout and the page of a parameterised route', () => {
    const { routes, layout, media, tracker } = setup();

    warmRoute(routes, '/media/movie/42?from=home');

    expect(layout).toHaveBeenCalledOnce();
    expect(media).toHaveBeenCalledOnce();
    expect(tracker).not.toHaveBeenCalled();
  });

  it('follows the root redirect', () => {
    const { routes, layout, discover } = setup();

    warmRoute(routes, '/');

    expect(layout).toHaveBeenCalledOnce();
    expect(discover).toHaveBeenCalledOnce();
  });

  it('loads a top-level page without the layout', () => {
    const { routes, layout, auth } = setup();

    warmRoute(routes, '/auth');

    expect(auth).toHaveBeenCalledOnce();
    expect(layout).not.toHaveBeenCalled();
  });

  it('loads nothing for an unknown path', () => {
    const { routes, layout, discover, media, auth } = setup();

    warmRoute(routes, '/nowhere/at/all');

    for (const loader of [layout, discover, media, auth]) expect(loader).not.toHaveBeenCalled();
  });
});
