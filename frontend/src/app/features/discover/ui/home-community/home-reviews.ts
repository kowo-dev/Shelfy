import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { ReviewResponse } from '@app/core/services/users/user-profile.model';
import { UserProfileService } from '@app/core/services/users/user-profile';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { creationView } from '@shared/ui/creation-card/creation-view';
import { ReviewCardComponent } from '@shared/ui/creation-card/review-card';
import { ShelfSectionComponent } from '@shared/ui/shelf-section/shelf-section';

export const COMMUNITY_MIN = 3;
const FETCHED = 10;

@Component({
  selector: 'shelfy-home-reviews',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ReviewCardComponent, ShelfSectionComponent],
  template: `
    @if (cards().length >= min) {
      <shelfy-shelf-section
        [title]="'home.popular_reviews' | translate"
        [subtitle]="'home.popular_reviews_sub' | translate"
        [moreLabel]="'home.community' | translate"
        [moreRoute]="['/creations']"
        [moreQuery]="{ f: 'reviews', sort: 'POPULAR' }"
        [band]="true"
        [rail]="null"
      >
        <div class="card-grid">
          @for (review of cards().slice(0, 3); track review.id) {
            <shelfy-review-card [review]="review" />
          }
        </div>
      </shelfy-shelf-section>
    }
  `,
  host: { class: 'block' },
})
export class HomeReviewsComponent {
  private readonly profiles = inject(UserProfileService);
  private readonly reviews = signal<ReviewResponse[]>([]);

  protected readonly min = COMMUNITY_MIN;

  readonly cards = computed(() =>
    this.reviews().filter((review) => {
      const view = creationView({ review });
      return !!view && !view.gated && !!review.media.coverUrl;
    }),
  );

  constructor() {
    this.profiles.browseReviews(0, FETCHED, { scope: 'ALL', sort: 'POPULAR' }).subscribe({
      next: (page) => this.reviews.set(page.content),
      error: () => this.reviews.set([]),
    });
  }
}
