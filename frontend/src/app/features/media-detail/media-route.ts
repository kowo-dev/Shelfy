import type { Route, UrlSegment } from '@angular/router';
import type { DetailMediaType } from './data-access/media-detail-view.util';

const NUMERIC_ID: Record<DetailMediaType, boolean> = {
  movie: true,
  tv_show: true,
  game: true,
  anime: true,
  manga: true,
  webtoon: true,
};

export const detailMediaRoute = (_route: Route, segments: UrlSegment[]): boolean => {
  const [, type, id] = segments.map((segment) => segment.path);
  if (!type || !id || !Object.hasOwn(NUMERIC_ID, type)) return false;
  return !NUMERIC_ID[type as DetailMediaType] || /^[1-9]\d*$/.test(id);
};
