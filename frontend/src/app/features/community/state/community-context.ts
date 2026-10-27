import type { Signal } from '@angular/core';
import type { CommunityScope, CommunitySort } from '@app/core/services/community/community.model';
import type { CommunityView } from '../data-access/community-url';

export interface CommunityContext {
  signedIn: Signal<boolean>;
  view: Signal<CommunityView>;
  scope: Signal<CommunityScope>;
  sort: Signal<CommunitySort>;
  query: Signal<string>;
}
