import type { MediaResponse } from '@app/core/services/collection/collection.model';

export const ESSENTIALS_SLOTS = 5;

export interface EssentialEntry {
  slot: number;
  userMediaId: string;
  media: MediaResponse;
}
