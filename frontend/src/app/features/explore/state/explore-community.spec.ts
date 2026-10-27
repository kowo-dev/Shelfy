import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleService } from '@app/core/services/people/people';
import { ListsService } from '@app/core/services/lists/lists';
import { VersusService } from '@app/core/services/versus/versus';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { createExploreCommunity, EXPLORE_COMMUNITY_SIZE } from './explore-community';

const page = <T>(content: T[]) => of({ content, page: 0, size: 3, totalElements: content.length });

describe('createExploreCommunity', () => {
  const browse = vi.fn(() => page([{ id: 'l1' }]));

  beforeEach(() => {
    browse.mockClear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PeopleService,
          useValue: {
            search: () =>
              page([{ id: 'u1', username: 'margot', displayName: 'Margot', avatarUrl: null }]),
          },
        },
        { provide: ListsService, useValue: { browse } },
        {
          provide: VersusService,
          useValue: { browsePools: () => throwError(() => new Error('down')) },
        },
        { provide: UserProfileService, useValue: { browseReviews: () => page([]) } },
      ],
    });
  });

  it('stays empty without text and keeps a failing source from hiding the others', () => {
    const text = signal('');
    const community = TestBed.runInInjectionContext(() => createExploreCommunity(text));
    TestBed.tick();
    expect(community()).toBeNull();
    expect(browse).not.toHaveBeenCalled();

    text.set(' dune ');
    TestBed.tick();

    expect(browse).toHaveBeenCalledWith(0, EXPLORE_COMMUNITY_SIZE, { q: 'dune' });
    expect(community()).toMatchObject({
      people: [{ username: 'margot', name: 'Margot' }],
      lists: [{ id: 'l1' }],
      versus: [],
      reviews: [],
    });
  });
});
