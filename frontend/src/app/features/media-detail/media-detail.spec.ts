import { ConfirmService } from '@app/core/services/confirm/confirm';
import { NEVER, of } from 'rxjs';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { AniListService } from '@app/core/services/anilist/anilist';
import { CollectionService } from '@app/core/services/collection/collection';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import { WatchLogService } from '@app/core/services/watch-log/watch-log';
import { AmbientService } from '@app/core/services/ambient/ambient';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { Subject } from 'rxjs';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { TranslateService } from '@app/core/services/translate/translate';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';

import { MediaDetailPageComponent } from './media-detail';

function collectionItem(overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
  return {
    id: 'ci-1',
    userId: 'u1',
    media: {} as CollectionItemResponse['media'],
    status: 'planned',
    rating: null,
    note: null,
    containsSpoilers: false,
    progress: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as CollectionItemResponse;
}

describe('MediaDetailPageComponent', () => {
  let itemSheet: {
    open: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    updated: Subject<CollectionItemResponse>;
  };
  let collectionService: {
    lookup: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    changes: typeof NEVER;
  };
  let toastService: { success: ReturnType<typeof vi.fn> };
  let tmdb: {
    getMovie: ReturnType<typeof vi.fn>;
    getTvShow: ReturnType<typeof vi.fn>;
    imageUrl: ReturnType<typeof vi.fn>;
  };

  async function setup(lookupResult: CollectionItemResponse | null = null, renderTemplate = false) {
    tmdb = {
      getMovie: vi.fn().mockReturnValue(
        of({
          id: 1,
          title: 'Movie',
          overview: 'overview',
          genres: [],
          cast: [],
          productionCompanies: [],
          backdropImagePaths: [],
          posterImagePaths: [],
        }),
      ),
      getTvShow: vi.fn(),
      imageUrl: vi.fn().mockReturnValue(null),
    };
    collectionService = {
      lookup: vi.fn().mockReturnValue(of(lookupResult)),
      create: vi.fn().mockReturnValue(of(collectionItem())),
      update: vi.fn().mockReturnValue(of(collectionItem())),
      remove: vi.fn().mockReturnValue(of(undefined)),
      changes: NEVER,
    };
    toastService = { success: vi.fn() };

    itemSheet = {
      open: vi.fn(),
      close: vi.fn(),
      updated: new Subject<CollectionItemResponse>(),
    };
    TestBed.configureTestingModule({
      imports: [MediaDetailPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ mediaType: 'movie', externalId: '1' })),
          },
        },
        { provide: TmdbService, useValue: tmdb },
        { provide: IgdbService, useValue: { imageUrl: () => null } },
        { provide: AniListService, useValue: {} },
        { provide: CollectionService, useValue: collectionService },
        {
          provide: UserProfileService,
          useValue: { getMediaReviews: vi.fn().mockReturnValue(of([])) },
        },
        { provide: WatchLogService, useValue: { list: vi.fn().mockReturnValue(of([])) } },
        { provide: ItemSheetService, useValue: itemSheet },
        {
          provide: AmbientService,
          useValue: { follow: vi.fn(), colorOf: vi.fn().mockResolvedValue(null) },
        },
        { provide: DateFormatService, useValue: { formatDate: () => '3 March' } },
        { provide: ToastService, useValue: toastService },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    if (!renderTemplate) {
      TestBed.overrideComponent(MediaDetailPageComponent, { set: { template: '<div></div>' } });
    }
    await TestBed.compileComponents();

    const fixture = TestBed.createComponent(MediaDetailPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the movie and its collection item on init', async () => {
    const fixture = await setup(collectionItem());
    const component = fixture.componentInstance;

    expect(tmdb.getMovie).toHaveBeenCalledWith(1);
    expect(component.loading()).toBe(false);
    expect(component.view().title).toBe('Movie');
    expect(component.collectionItem()?.id).toBe('ci-1');
  });

  it('always asks before removing, even a bare backlog title', async () => {
    const item = collectionItem({ status: 'planned' });
    const fixture = await setup(item);
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);

    await fixture.componentInstance.removeFromShelf(item);
    expect(ask).toHaveBeenCalled();
    expect(collectionService.remove).not.toHaveBeenCalled();

    ask.mockResolvedValue(true);
    await fixture.componentInstance.removeFromShelf(item);
    expect(collectionService.remove).toHaveBeenCalledWith('ci-1');
    expect(fixture.componentInstance.collectionItem()).toBeNull();
  });

  it('links the review button to my review, or to a new one for an unshelved title', async () => {
    const shelved = await setup(collectionItem({ note: { type: 'doc' } }));
    expect(shelved.componentInstance.reviewLink().commands).toEqual(['/reviews', 'ci-1', 'edit']);
    expect(shelved.componentInstance.reviewLabel()).toBe('collection.sheet.edit_review');
    TestBed.resetTestingModule();

    const fresh = await setup(null);
    const link = fresh.componentInstance.reviewLink();
    expect(link.commands).toEqual(['/reviews/new']);
    expect(link.queryParams).toEqual(
      expect.objectContaining({ provider: 'tmdb', mediaType: 'movie', externalId: '1' }),
    );
    expect(fresh.componentInstance.reviewLabel()).toBe('collection.sheet.write_review');
  });

  it('setStatus() shelves an unshelved title with that status, or updates mine', async () => {
    const fresh = await setup(null);
    fresh.componentInstance.setStatus('ongoing');
    expect(collectionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: '1', status: 'ongoing' }),
    );
    TestBed.resetTestingModule();

    const shelved = await setup(collectionItem({ status: 'planned' }));
    shelved.componentInstance.setStatus('done');
    expect(collectionService.update).toHaveBeenCalledWith('ci-1', { status: 'done' });
  });

  it('rate() shelves an unshelved title with the rating in one call', async () => {
    const fixture = await setup(null);

    fixture.componentInstance.rate(8);

    expect(collectionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: '1', mediaType: 'movie', rating: 8, status: 'done' }),
    );
    expect(fixture.componentInstance.collectionItem()?.id).toBe('ci-1');
  });

  it('rate() updates or clears the rating of a shelved title', async () => {
    const fixture = await setup(collectionItem({ rating: 6, status: 'done' }));
    collectionService.update.mockReturnValue(of(collectionItem({ rating: 9, status: 'done' })));

    fixture.componentInstance.rate(9);
    expect(collectionService.update).toHaveBeenCalledWith('ci-1', { rating: 9 });

    fixture.componentInstance.rate(null);
    expect(collectionService.update).toHaveBeenLastCalledWith('ci-1', { clearRating: true });
  });

  it('openImagePreview finds the index of the image and closeImagePreview clears it', async () => {
    const fixture = await setup(null);
    const component = fixture.componentInstance;
    component.selectedImageIndex.set(null);

    component.openImagePreview('unknown.jpg');
    expect(component.selectedImageIndex()).toBeNull();

    component.selectedImageIndex.set(2);
    component.closeImagePreview();
    expect(component.selectedImageIndex()).toBeNull();
  });

  it('follows what the drawer saved and closes it on destroy', async () => {
    const fixture = await setup(collectionItem());
    const component = fixture.componentInstance;

    itemSheet.updated.next(collectionItem({ rating: 9 }));
    expect(component.collectionItem()?.rating).toBe(9);

    fixture.destroy();
    expect(itemSheet.close).toHaveBeenCalled();
  });

  describe('page structure', () => {
    const text = (el: HTMLElement, selector: string) =>
      el.querySelector(selector)?.textContent?.trim();

    it('keeps the shelf actions out of the hero for a signed-out visitor', async () => {
      const fixture = await setup(null, true);
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('.tracker .acc')).toBeNull();
      expect(el.querySelector('shelfy-item-editor')).toBeNull();
    });

    it('turns the add button into the shared edit block once shelved', async () => {
      const fixture = await setup(collectionItem({ status: 'ongoing' }), true);
      const el = fixture.nativeElement as HTMLElement;
      const radios = [...el.querySelectorAll('shelfy-item-editor [role="radio"]')];

      expect(el.querySelector('.media-info shelfy-item-editor')).not.toBeNull();
      expect(radios).toHaveLength(4);
      expect(radios.filter((radio) => radio.getAttribute('aria-checked') === 'true')).toHaveLength(
        1,
      );
      expect(
        [...el.querySelectorAll('.media-info .tracker button')].find((button) =>
          button.getAttribute('aria-label')?.includes('collection.sheet.remove'),
        ),
      ).toBeDefined();
    });

    it('puts the overview in the information section', async () => {
      const fixture = await setup(null, true);
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('.media-info #overview-text')).toBeNull();
      expect(text(el, '#sec-details #overview-text')).toBe('overview');
    });
  });
});
