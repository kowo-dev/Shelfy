import { inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DiscoverService } from '@app/core/services/discover/discover';
import { TmdbService } from '@app/core/services/tmdb/tmdb';

const WALL_SIZE = 30;

export function createPosterWall() {
  const discover = inject(DiscoverService);
  const tmdb = inject(TmdbService);
  const posters = signal<string[]>([]);
  let requested = false;

  function load(): void {
    if (requested) return;
    requested = true;
    forkJoin([
      discover.getMovies('trending', 0, WALL_SIZE / 2),
      discover.getSeries('trending', 0, WALL_SIZE / 2),
    ]).subscribe({
      next: ([movies, series]) =>
        posters.set(
          [...movies.content, ...series.content]
            .map((title) => tmdb.imageUrl(title.posterPath, 'w342'))
            .filter((url): url is string => !!url),
        ),
      error: () => posters.set([]),
    });
  }

  return { posters: posters.asReadonly(), load };
}
