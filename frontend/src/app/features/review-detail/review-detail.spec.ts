import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { AuthService } from '@app/core/services/auth/auth';
import { ReviewCommentsService } from '@app/core/services/reviews/review-comments';
import { ToastService } from '@app/core/services/toast/toast';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TranslateService } from '@app/core/services/translate/translate';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import type { WatchLogEntry } from '@app/core/services/watch-log/watch-log.model';

import { ReviewDetailPageComponent } from './review-detail';

function route(query: Record<string, string> = {}, fragment: string | null = null) {
  return {
    paramMap: of(convertToParamMap({ id: 'r1' })),
    snapshot: { queryParamMap: convertToParamMap(query), fragment },
  };
}

function review(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    id: 'r1',
    userId: 'user-1',
    username: 'kowo',
    displayName: null,
    avatarUrl: null,
    media: { mediaType: 'movie', externalId: '1', title: 'Heat', coverUrl: null },
    rating: null,
    content: { ops: [{ insert: 'Great' }] },
    containsSpoilers: false,
    isLikedByViewer: false,
    likeCount: 0,
    comments: [],
    commentCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as unknown as ReviewResponse;
}

describe('ReviewDetailPageComponent', () => {
  let profiles: {
    getReview: ReturnType<typeof vi.fn>;
    getReviewWatchLog: ReturnType<typeof vi.fn>;
    likeReview: ReturnType<typeof vi.fn>;
    unlikeReview: ReturnType<typeof vi.fn>;
  };
  let toast: { error: ReturnType<typeof vi.fn> };
  let viewings: WatchLogEntry[] = [];

  beforeEach(() => {
    viewings = [];
  });

  function configure(currentUserId = 'user-1', overrides: Partial<ReviewResponse> = {}) {
    profiles = {
      getReview: vi.fn().mockReturnValue(of(review(overrides))),
      getReviewWatchLog: vi.fn().mockReturnValue(of(viewings)),
      likeReview: vi.fn().mockReturnValue(of(undefined)),
      unlikeReview: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ReviewDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route() },
        { provide: UserProfileService, useValue: profiles },
        {
          provide: AuthService,
          useValue: { currentUser: () => ({ id: currentUserId }), isAuthenticated: () => true },
        },
        { provide: ReviewCommentsService, useValue: {} },
        { provide: ToastService, useValue: toast },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        {
          provide: DateFormatService,
          useValue: { formatDateTime: () => 'formatted', formatDate: () => 'date' },
        },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
  }

  function setup(currentUserId = 'user-1', overrides: Partial<ReviewResponse> = {}) {
    configure(currentUserId, overrides);
    return TestBed.createComponent(ReviewDetailPageComponent).componentInstance;
  }

  function render(currentUserId = 'user-1', overrides: Partial<ReviewResponse> = {}) {
    configure(currentUserId, overrides);
    const fixture = TestBed.createComponent(ReviewDetailPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the review for the route id', () => {
    const component = setup();

    expect(profiles.getReview).toHaveBeenCalledWith('r1');
    expect(component.review()?.id).toBe('r1');
  });

  it('isMine compares against the current user id', () => {
    const component = setup('user-1');

    expect(component.isMine('user-1')).toBe(true);
    expect(component.isMine('someone-else')).toBe(false);
    expect(component.isMine(undefined)).toBe(false);
  });

  it('toggleLike flips the heart at once and keeps it on success', () => {
    const component = setup();

    component.toggleLike();

    expect(profiles.likeReview).toHaveBeenCalledWith('r1');
    expect(component.liked()).toBe(true);
    expect(component.likeCount()).toBe(1);
    expect(component.liking()).toBe(false);
  });

  it('toggleLike rolls back and toasts when the request fails', () => {
    const component = setup();
    profiles.likeReview.mockReturnValue(throwError(() => new Error('boom')));

    component.toggleLike();

    expect(component.liked()).toBe(false);
    expect(component.likeCount()).toBe(0);
    expect(component.liking()).toBe(false);
  });

  it('shows Edit and no Like to the owner', () => {
    const element: HTMLElement = render('user-1').nativeElement;

    expect(element.querySelector('a[href="/reviews/r1/edit"]')).not.toBeNull();
    expect(element.querySelector('button[aria-pressed]')).toBeNull();
  });

  it('shows Like to other viewers', () => {
    const element: HTMLElement = render('someone-else').nativeElement;

    expect(element.querySelector('a[href="/reviews/r1/edit"]')).toBeNull();
    expect(element.querySelector('button[aria-pressed="false"]')).not.toBeNull();
  });

  it('has no menu button', () => {
    const element: HTMLElement = render().nativeElement;

    expect(element.querySelector('shelfy-menu-button')).toBeNull();
  });

  it('shows the discussion in its own tab', () => {
    const fixture = render();
    expect(fixture.nativeElement.querySelector('#comments shelfy-comments')).toBeNull();

    fixture.componentInstance.tab.set('discussion');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#comments shelfy-comments')).not.toBeNull();
  });

  it('jumps to the discussion from the tab query param or the comments fragment', () => {
    setup();
    expect(
      TestBed.createComponent(ReviewDetailPageComponent).componentInstance.startsAtComments,
    ).toBe(false);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ReviewDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route({ tab: 'discussion' }) },
        { provide: UserProfileService, useValue: { getReview: () => of(review()) } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: ReviewCommentsService, useValue: {} },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    expect(
      TestBed.createComponent(ReviewDetailPageComponent).componentInstance.startsAtComments,
    ).toBe(true);
  });

  it('lists the authors viewings in their own tab, spoilers hidden', () => {
    const entry = (id: string, over: Partial<WatchLogEntry>): WatchLogEntry => ({
      id,
      occurredAt: '2024-03-12',
      isRewatch: false,
      name: null,
      rating: null,
      review: null,
      containsSpoilers: false,
      source: 'manual',
      createdAt: '2024-03-12T00:00:00Z',
      ...over,
    });
    const text = (value: string) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
    });
    viewings = [
      entry('a', { rating: 7, review: text('First time, a bit long.') }),
      entry('b', {
        occurredAt: '2026-10-03',
        isRewatch: true,
        review: text('The butler did it.'),
        containsSpoilers: true,
      }),
    ];

    const fixture = render();
    expect(fixture.componentInstance.pageTabs().map((tab) => tab.label)).toContain(
      'review.viewings.watch',
    );
    fixture.componentInstance.tab.set('viewings');
    fixture.detectChanges();
    const aside = (fixture.nativeElement as HTMLElement).querySelector('shelfy-watch-log-timeline');

    expect(profiles.getReviewWatchLog).toHaveBeenCalledWith('r1');
    expect(
      [...(aside?.querySelectorAll('li') ?? [])].map((li) => li.textContent?.match(/\d{4}/)?.[0]),
    ).toEqual(['2026', '2024']);
    expect(aside?.querySelector('button')).toBeNull();
    expect(aside?.textContent).toContain('First time, a bit long.');
    expect(aside?.textContent).not.toContain('The butler did it.');
    expect(aside?.textContent).toContain('review.spoiler_warning');
    expect(aside?.querySelector('shelfy-rating-value')).not.toBeNull();
  });

  it('shows no viewings section when nothing is logged or the log fails', () => {
    configure();
    profiles.getReviewWatchLog.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(ReviewDetailPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.pageTabs().map((tab) => tab.id)).not.toContain('viewings');
  });

  it('shows the rating block only when the review is rated', () => {
    const unrated: HTMLElement = render().nativeElement;
    expect(unrated.querySelector('shelfy-rating-slider')).toBeNull();
    TestBed.resetTestingModule();

    const rated: HTMLElement = render('user-1', { rating: 8 }).nativeElement;
    expect(rated.querySelector('shelfy-rating-slider')).not.toBeNull();
  });

  it('commentsSource wires all comment operations to the review id', () => {
    const commentsService = {
      comments: vi.fn(),
      comment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      voteComment: vi.fn(),
      removeCommentVote: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [ReviewDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route() },
        { provide: UserProfileService, useValue: { getReview: () => of(review()) } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: ReviewCommentsService, useValue: commentsService },
        { provide: ToastService, useValue: { error: vi.fn() } },
        { provide: ErrorMessageService, useValue: { fromApiError: () => 'error' } },
        { provide: DateFormatService, useValue: { formatDateTime: () => 'formatted' } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const component = TestBed.createComponent(ReviewDetailPageComponent).componentInstance;

    const source = component.commentsSource('r1');
    source.list(0, 10, 'recent');
    source.add('hello', undefined);
    source.vote('c1', 1);

    expect(commentsService.comments).toHaveBeenCalledWith('r1', 0, 10, 'recent');
    expect(commentsService.comment).toHaveBeenCalledWith('r1', 'hello', undefined);
    expect(commentsService.voteComment).toHaveBeenCalledWith('r1', 'c1', 1);
  });
});
