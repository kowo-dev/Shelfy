import { TestBed } from '@angular/core/testing';
import { AuthService } from '@app/core/services/auth/auth';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { ItemSheetService } from './item-sheet';

describe('ItemSheetService', () => {
  const item = { id: 'i1', status: 'ongoing' } as CollectionItemResponse;
  let service: ItemSheetService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { currentUser: () => ({ id: 'u1' }) } }],
    });
    service = TestBed.inject(ItemSheetService);
  });

  it('opens and closes', () => {
    service.open(item);
    expect(service.item()).toBe(item);
    service.close();
    expect(service.item()).toBeNull();
  });

  it('notifies updates and keeps the open item fresh', () => {
    const seen: CollectionItemResponse[] = [];
    service.updated.subscribe((i) => seen.push(i));
    service.open(item);
    const next = { ...item, status: 'done' } as CollectionItemResponse;
    service.notifyUpdated(next);
    expect(service.item()).toBe(next);
    expect(seen).toEqual([next]);
  });

  it('opens the bulk drawer instead of the single one, and vice versa', () => {
    service.open(item);
    service.openBulk([item], ['done']);
    expect(service.item()).toBeNull();
    expect(service.bulk()).toEqual({ items: [item], statuses: ['done'] });
    service.open(item);
    expect(service.bulk()).toBeNull();
    service.openBulk([item], ['done']);
    service.close();
    expect(service.bulk()).toBeNull();
  });
});
