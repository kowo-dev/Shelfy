import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { catchError, combineLatest, map, of, type Observable } from 'rxjs';
import { DiscoverService } from '@app/core/services/discover/discover';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { ToastContainerComponent } from '../ui/toast/toast';

const WALL_COLUMNS = 4;
const POSTERS_PER_COLUMN = 8;

export function posterColumns(sources: string[][], columns: number, perColumn: number): string[][] {
  const mixed: string[] = [];
  const longest = Math.max(0, ...sources.map((s) => s.length));
  for (let i = 0; i < longest; i++) {
    for (const source of sources) {
      if (source[i]) mixed.push(source[i]);
    }
  }
  if (!mixed.length) return [];
  return Array.from({ length: columns }, (_, c) =>
    Array.from({ length: perColumn }, (_, r) => mixed[(c * perColumn + r) % mixed.length]),
  );
}

@Component({
  selector: 'shelfy-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, TranslatePipe, ToastContainerComponent],
  template: `
    <div class="bg-background min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      <aside
        class="v-auth-wall relative h-[34vh] overflow-hidden lg:order-2 lg:h-auto"
        aria-hidden="true"
      >
        <div class="v-wall animate-fade-in">
          @for (column of wall(); track $index) {
            <div>
              @for (url of column; track $index) {
                <img [src]="url" alt="" draggable="false" decoding="async" />
              }
              @for (url of column; track $index) {
                <img [src]="url" alt="" draggable="false" decoding="async" />
              }
            </div>
          }
        </div>
      </aside>

      <div
        class="relative z-10 flex flex-col px-[clamp(1.5rem,5vw,5rem)] pb-8 max-lg:-mt-14 lg:min-h-dvh lg:py-7"
      >
        <a
          routerLink="/discover"
          class="font-display text-text shrink-0 self-start text-[1.8rem] leading-none font-extrabold tracking-[-0.05em] max-lg:hidden"
          >Shelfy</a
        >
        <main class="flex flex-1 flex-col justify-center py-4 lg:py-12">
          <div class="animate-rise-in mx-auto w-full max-w-[26.25rem]">
            <router-outlet />
          </div>
        </main>

        <footer
          class="text-text-subtle flex flex-wrap items-center gap-x-5.5 gap-y-1.5 text-[0.8125rem]"
        >
          <a routerLink="/legal/privacy-policy" class="hover:text-text transition-colors">{{
            'auth.terms_privacy_policy' | translate
          }}</a>
          <a routerLink="/legal/terms" class="hover:text-text transition-colors">{{
            'auth.terms_of_service' | translate
          }}</a>
          <a routerLink="/legal/notice" class="hover:text-text transition-colors">{{
            'legal.notice.title' | translate
          }}</a>
          <a
            href="https://github.com/kowo-dev/Shelfy"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-text transition-colors"
            >Made by &#64;kowo</a
          >
          <span>{{ 'auth.tagline' | translate }}</span>
        </footer>
      </div>
    </div>
    <shelfy-toast-container />
  `,
})
export class AuthLayoutComponent {
  private readonly discover = inject(DiscoverService);
  private readonly tmdb = inject(TmdbService);
  private readonly igdb = inject(IgdbService);

  private readonly posters = toSignal(
    combineLatest([
      this.urls(this.discover.getMovies('trending', 0, 20), (m) =>
        m.isAdult ? null : this.tmdb.imageUrl(m.posterPath, 'w500'),
      ),
      this.urls(this.discover.getSeries('trending', 0, 20), (s) =>
        s.isAdult ? null : this.tmdb.imageUrl(s.posterPath, 'w500'),
      ),
      this.urls(this.discover.getGames('trending', 0, 20), (g) =>
        g.isAdult ? null : this.igdb.imageUrl(g.coverImageId, 't_cover_big_2x'),
      ),
    ]),
    { initialValue: [[], [], []] },
  );

  readonly wall = computed(() => posterColumns(this.posters(), WALL_COLUMNS, POSTERS_PER_COLUMN));

  private urls<T>(
    feed: Observable<{ content: T[] }>,
    toUrl: (item: T) => string | null,
  ): Observable<string[]> {
    return feed.pipe(
      map(({ content }) => content.map(toUrl).filter((url): url is string => !!url)),
      catchError(() => of([])),
    );
  }
}
