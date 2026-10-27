import { Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';

const DEFAULT_DESCRIPTION =
  'Shelfy is a self-hosted media tracker: one shelf for the movies, series, games, anime, manga and webtoons you love, with lists, reviews and people to follow. No tracking.';

const MAX_LENGTH = 160;

@Injectable({ providedIn: 'root' })
export class PageMetaService {
  private readonly meta = inject(Meta);

  setDescription(text: string | null | undefined): void {
    const description = summarize(text) || DEFAULT_DESCRIPTION;
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ name: 'twitter:description', content: description });
  }

  setTitle(title: string): void {
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ name: 'twitter:title', content: title });
  }

  reset(title: string): void {
    this.setTitle(title);
    this.setDescription(null);
  }
}

function summarize(text: string | null | undefined): string {
  if (!text) return '';
  const plain = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= MAX_LENGTH) return plain;
  const cut = plain.slice(0, MAX_LENGTH - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)}…`;
}
