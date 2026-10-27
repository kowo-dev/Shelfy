import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AniListService } from '@app/core/services/anilist/anilist';
import type { MediaResponse } from '@app/core/services/collection/collection.model';
import { IgdbService } from '@app/core/services/igdb/igdb';

export type ArtMedia = Pick<MediaResponse, 'id' | 'mediaType' | 'externalId' | 'metadata'>;

const STEAM_HERO_URL = 'https://cdn.akamai.steamstatic.com/steam/apps';

@Injectable({ providedIn: 'root' })
export class ShelfArtService {
  private readonly igdb = inject(IgdbService);
  private readonly aniList = inject(AniListService);
  private readonly cache = new Map<string, Promise<string | null>>();

  storedBackdrop(media: ArtMedia): string | null {
    const backdrop = media.metadata?.['backdropUrl'];
    return typeof backdrop === 'string' && backdrop ? backdrop : null;
  }

  needsLookup(media: ArtMedia): boolean {
    if (this.storedBackdrop(media)) return false;
    if (this.steamAppId(media)) return true;
    return (
      ['game', 'anime', 'manga', 'webtoon'].includes(media.mediaType) &&
      Number.isFinite(Number(media.externalId))
    );
  }

  hasArt(media: ArtMedia): boolean {
    return !!this.storedBackdrop(media) || this.needsLookup(media);
  }

  lookup(media: ArtMedia): Promise<string | null> {
    const cached = this.cache.get(media.id);
    if (cached) return cached;
    const pending = this.resolve(media).catch(() => {
      this.cache.delete(media.id);
      return null;
    });
    this.cache.set(media.id, pending);
    return pending;
  }

  imageExists(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });
  }

  private async resolve(media: ArtMedia): Promise<string | null> {
    const stored = this.storedBackdrop(media);
    if (stored) return stored;
    const appId = this.steamAppId(media);
    if (appId) {
      const hero = `${STEAM_HERO_URL}/${appId}/library_hero.jpg`;
      if (await this.imageExists(hero)) return hero;
    }
    const id = Number(media.externalId);
    if (!Number.isFinite(id)) return null;
    switch (media.mediaType) {
      case 'game': {
        const game = await firstValueFrom(this.igdb.getGame(id));
        const [imageId] = [...game.artworkImageIds, ...game.screenshotImageIds];
        return this.igdb.imageUrl(imageId ?? null, 't_1080p');
      }
      case 'anime':
        return (await firstValueFrom(this.aniList.getAnime(id))).bannerImageUrl;
      case 'manga':
      case 'webtoon':
        return (await firstValueFrom(this.aniList.getManga(id))).bannerImageUrl;
      default:
        return null;
    }
  }

  private steamAppId(media: ArtMedia): string | null {
    if (media.mediaType !== 'game') return null;
    const appId = media.metadata?.['steamAppId'];
    return typeof appId === 'number' || (typeof appId === 'string' && appId) ? String(appId) : null;
  }
}
