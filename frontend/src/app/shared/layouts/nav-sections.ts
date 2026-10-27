import type { IconName } from '@shared/ui/icon/icon-registry';

export interface NavDestination {
  path: string;
  labelKey: string;
  descriptionKey: string;
  icon: IconName;
  requiresAuth: boolean;
  activePaths?: readonly string[];
}

const DISCOVER: NavDestination = {
  path: '/discover',
  labelKey: 'nav.discover',
  descriptionKey: 'nav.desc.discover',
  icon: 'discover',
  requiresAuth: false,
};

export const EXPLORE: NavDestination = {
  path: '/explore',
  labelKey: 'nav.explore',
  descriptionKey: 'nav.desc.explore',
  icon: 'discover',
  requiresAuth: false,
};

const COLLECTION: NavDestination = {
  path: '/collection',
  labelKey: 'nav.shelf',
  descriptionKey: 'nav.desc.collection',
  icon: 'shelf',
  requiresAuth: true,
};

export const CREATIONS: NavDestination = {
  path: '/creations',
  labelKey: 'nav.creations',
  descriptionKey: 'nav.desc.creations',
  icon: 'reviews',
  requiresAuth: false,
  activePaths: ['/lists', '/versus', '/reviews'],
};

export const PEOPLE: NavDestination = {
  path: '/people',
  labelKey: 'nav.people',
  descriptionKey: 'nav.desc.people',
  icon: 'people',
  requiresAuth: true,
  activePaths: ['/users', '/profile/'],
};

export const PROFILE: NavDestination = {
  path: '/profile',
  labelKey: 'nav.profile',
  descriptionKey: 'nav.desc.profile',
  icon: 'user',
  requiresAuth: true,
};

export const DESKTOP_DESTINATIONS: readonly NavDestination[] = [
  DISCOVER,
  COLLECTION,
  CREATIONS,
  PEOPLE,
];

export const NOTIFICATIONS: NavDestination = {
  path: '/notifications',
  labelKey: 'nav.notifications',
  descriptionKey: 'nav.desc.notifications',
  icon: 'bell',
  requiresAuth: true,
};

export const SETTINGS: NavDestination = {
  path: '/settings',
  labelKey: 'nav.settings',
  descriptionKey: 'nav.desc.settings',
  icon: 'settings',
  requiresAuth: true,
};

export const ADMIN: NavDestination = {
  path: '/admin',
  labelKey: 'nav.admin',
  descriptionKey: 'nav.desc.admin',
  icon: 'settingsSliders',
  requiresAuth: true,
};

export function visibleTo(signedIn: boolean): (link: NavDestination) => boolean {
  return (link) => signedIn || !link.requiresAuth;
}

export function ownsUrl(url: string, link: NavDestination): boolean {
  return [link.path, ...(link.activePaths ?? [])].some((path) => isPathActive(url, path));
}

export function isPathActive(url: string, path: string): boolean {
  const clean = url.split(/[?#]/)[0];
  if (path.endsWith('/')) return clean.startsWith(path);
  return clean === path || clean.startsWith(path + '/');
}
