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
    <article class="v-pc">
      <div class="v-pc-art">
        @if (person().bannerUrl; as banner) {
          <span
            ><img [src]="rendition(banner, 'wide')" alt="" loading="lazy" draggable="false"
          /></span>
        } @else {
          <span class="bg-profile-fallback"></span>
        }
        @if (note(); as key) {
          <small class="v-pc-note">{{ key | translate }}</small>
        }
      </div>
      <div class="v-pc-body">
        @if (person().avatarUrl; as avatar) {
          <img class="v-pc-av" [src]="avatar" alt="" draggable="false" />
        } @else {
          <span class="v-pc-av">{{ initials() }}</span>
        }
        <div class="v-pc-id">
          <a [routerLink]="['/profile', person().username]">{{ person().name }}</a>
          <span>&#64;{{ person().username }}</span>
        </div>
      </div>
      <div class="v-pc-foot">
        @let followers = person().followersCount ?? null;
        @let titles = person().titleCount;
        @if (followers !== null || titles !== null) {
          <p class="v-pc-stats">
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
        <div class="v-pc-acts">
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
