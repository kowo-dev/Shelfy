import type { UserMediaStatus } from '@app/core/services/collection/collection.model';
import type { QuickAction } from './quick-action-icon.util';

type Tracked = { status: UserMediaStatus };

export function ownedQuickActions(owned: Tracked | null | undefined): readonly QuickAction[] {
  return owned ? ['delete'] : ['add'];
}
