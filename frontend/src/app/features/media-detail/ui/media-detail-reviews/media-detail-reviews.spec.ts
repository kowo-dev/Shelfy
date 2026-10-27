import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';

import { MediaDetailReviewsComponent } from './media-detail-reviews';

function review(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    id: '1',
    userId: 'u1',
    username: 'kowo',
    displayName: null,
    avatarUrl: null,
    media: {} as ReviewResponse['media'],
    rating: null,
    content: { ops: [{ insert: 'Great movie' }] },
    containsSpoilers: false,
    isLikedByViewer: false,
    likeCount: 0,
    comments: [],
    commentCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('MediaDetailReviewsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaDetailReviewsComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('renders nothing when there are no reviews', () => {
    const fixture = TestBed.createComponent(MediaDetailReviewsComponent);
    fixture.componentRef.setInput('reviews', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('article')).toBeNull();
  });

  it('links to the review and to the author profile, preferring displayName', () => {
    const fixture = TestBed.createComponent(MediaDetailReviewsComponent);
    fixture.componentRef.setInput('reviews', [
      review({ id: 'r1', username: 'kowo', displayName: 'Kowo' }),
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a[href="/reviews/r1"]')).not.toBeNull();
    const author = el.querySelector('a[href="/profile/kowo"]') as HTMLAnchorElement;
    expect(author.textContent).toContain('Kowo');
  });

  it("shows the reviewer's rating next to their handle, and nothing when unrated", () => {
    const fixture = TestBed.createComponent(MediaDetailReviewsComponent);
    fixture.componentRef.setInput('reviews', [
      review({ id: 'r1', rating: 7 }),
      review({ id: 'r2' }),
    ]);
    fixture.detectChanges();

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('article');
    expect(cards[0].querySelector('shelfy-rating-value')?.textContent).toContain('3.5');
    expect(cards[1].querySelector('shelfy-rating-value')).toBeNull();
  });

  it('has no edit button: a review is opened, not edited', () => {
    const fixture = TestBed.createComponent(MediaDetailReviewsComponent);
    fixture.componentRef.setInput('reviews', [review()]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('falls back to the username when displayName is null', () => {
    const fixture = TestBed.createComponent(MediaDetailReviewsComponent);
    fixture.componentRef.setInput('reviews', [review({ username: 'kowo', displayName: null })]);
    fixture.detectChanges();

    const author = fixture.nativeElement.querySelector('a[href="/profile/kowo"]');
    expect(author.textContent).toContain('kowo');
  });
});
