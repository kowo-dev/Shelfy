import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@app/core/services/auth/auth';
import { CollectionService } from '@app/core/services/collection/collection';
import type {
  CollectionChangeEvent,
  CollectionItemResponse,
  MediaResponse,
} from '@app/core/services/collection/collection.model';
import { ShelfLookupService } from './shelf-lookup';

const media = { provider: 'tmdb', mediaType: 'movie', externalId: '1' } as MediaResponse;
const own = { id: 'i1', media } as CollectionItemResponse;

describe('ShelfLookupService', () => {
  const changes = new Subject<CollectionChangeEvent>();
  const user = signal<object | null>({ id: 'u' });
  let lookupBatch: ReturnType<typeof vi.fn>;
  let service: ShelfLookupService;

  beforeEach(() => {
    user.set({ id: 'u' });
    lookupBatch = vi.fn().mockReturnValue(of({ 'tmdb:movie:1': own }));
    TestBed.configureTestingModule({
      providers: [
        { provide: CollectionService, useValue: { lookupBatch, changes } },
        { provide: AuthService, useValue: { currentUser: user } },
      ],
    });
    service = TestBed.inject(ShelfLookupService);
    TestBed.tick();
  });

  it('batches requests into one lookup and answers from the result', async () => {
    service.request(media);
    service.request(media);
    await Promise.resolve();

    expect(lookupBatch).toHaveBeenCalledTimes(1);
    expect(service.find(media)).toBe(own);
  });

  it('does nothing when logged out', async () => {
    user.set(null);
    service.request(media);
    await Promise.resolve();

    expect(lookupBatch).not.toHaveBeenCalled();
  });

  it('follows collection updates and removals', async () => {
    service.request(media);
    await Promise.resolve();
    const edited = { ...own, rating: 9 } as CollectionItemResponse;

    changes.next({ type: 'updated', item: edited });
    TestBed.tick();
    expect(service.find(media)).toBe(edited);

    changes.next({ type: 'removed', id: 'i1' });
    TestBed.tick();
    expect(service.find(media)).toBeNull();
  });
});
