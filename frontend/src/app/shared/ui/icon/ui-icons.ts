import { provideEnvironmentInitializer } from '@angular/core';
import {
  provideNgIconLoader,
  provideNgIconsConfig,
  withCaching,
  withContentSecurityPolicy,
} from '@ng-icons/core';

const loadRegistry = () => import('./icon-registry');

export function provideUiIcons() {
  return [
    provideNgIconsConfig({}, withContentSecurityPolicy()),
    provideNgIconLoader(
      (name) => loadRegistry().then(({ svgFor }) => svgFor(name) ?? ''),
      withCaching(),
    ),
    provideEnvironmentInitializer(() => void loadRegistry()),
  ];
}
