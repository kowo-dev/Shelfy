import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { imageRendition } from '@shared/utils/image-rendition.util';
import type { Connection } from './connections';

@Component({
  selector: 'shelfy-person-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  host: { class: 'block' },
  template: `
    <article class="person-card">
      <div class="person-card-art">
        @if (person().bannerUrl; as banner) {
          <span
            ><img [src]="rendition(banner, 'wide')" alt="" loading="lazy" draggable="false"
          /></span>
        } @else {
          <span class="bg-profile-fallback"></span>
        }
        @if (note(); as key) {
          <small class="person-card-note">{{ key | translate }}</small>
        }
      </div>
      <div class="person-card-body">
        @if (person().avatarUrl; as avatar) {
          <img class="person-card-avatar" [src]="avatar" alt="" draggable="false" />
        } @else {
          <span class="person-card-avatar">{{ initials() }}</span>
        }
        <div class="person-card-id">
          <a [routerLink]="['/profile', person().username]">{{ person().name }}</a>
          <span>&#64;{{ person().username }}</span>
        </div>
      </div>
      <div class="person-card-foot">
        @let followers = person().followersCount ?? null;
        @let titles = person().titleCount;
        @if (followers !== null || titles !== null) {
          <p class="person-card-stats">
            @if (followers !== null) {
              <span
                ><b>{{ followers }}</b>
                {{ 'community.people.followers_label' | translate: { count: followers } }}</span
              >
            }
            @if (titles !== null) {
              <span
                ><b>{{ titles }}</b>
                {{ 'community.people.titles_label' | translate: { count: titles } }}</span
              >
            }
          </p>
        }
        <div class="person-card-actions">
          <ng-content />
        </div>
      </div>
    </article>
  `,
})
export class PersonCardComponent {
  protected readonly rendition = imageRendition;

  readonly person = input.required<Connection>();
  readonly note = input<string | null>(null);

  readonly initials = computed(() =>
    this.person()
      .name.split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );
}
