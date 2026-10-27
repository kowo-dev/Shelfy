import { computed, inject, Injectable, signal } from '@angular/core';
import type { MediaType } from '@app/core/services/collection/collection.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { SearchService } from './search';
import { EXPLORE_ALIASES } from './explore-aliases';
import { criterionKind, type ExploreCriterion } from './explore-query';
import type {
  ExploreCriterionGroup,
  ExploreOption,
  ExploreVocabulary,
  ExploreVocabularyEntry,
} from './search.model';

export const EXPLORE_MEDIA_TYPES: MediaType[] = [
  'movie',
  'tv_show',
  'anime',
  'manga',
  'webtoon',
  'game',
];

const CATEGORY_ALIASES: Record<string, string[]> = {
  movie: ['films', 'film', 'movies', 'movie', 'cinéma'],
  tv_show: ['séries', 'série', 'series', 'tv', 'shows'],
  anime: ['anime', 'animés', 'animation japonaise'],
  manga: ['manga', 'mangas'],
  webtoon: ['webtoon', 'webtoons', 'manhwa'],
  game: ['jeux vidéo', 'jeux', 'jeu', 'games', 'game', 'video games'],
};

export type ExploreSuggestion =
  | { kind: 'category'; type: MediaType; label: string }
  | { kind: 'criterion'; criterion: ExploreCriterion; label: string; group: string };

interface ScoredSuggestion {
  score: number;
  suggestion: ExploreSuggestion;
}

export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').toLowerCase().trim();
}

function matchScore(candidates: string[], needle: string): number {
  let best = 0;
  for (const candidate of candidates) {
    const value = normalizeSearchText(candidate);
    if (value === needle) return 3;
    if (value.startsWith(needle)) best = Math.max(best, 2);
    else if (value.split(/[\s-]+/).some((word) => word.startsWith(needle)))
      best = Math.max(best, 1);
  }
  return best;
}

function regionFor(lang: string): string {
  try {
    const region = new Intl.Locale(globalThis.navigator?.language ?? lang).maximize().region;
    return region && /^[A-Z]{2}$/.test(region) ? region : 'US';
  } catch {
    return 'US';
  }
}

@Injectable({ providedIn: 'root' })
export class ExploreCatalogService {
  private readonly searchService = inject(SearchService);
  private readonly translate = inject(TranslateService);

  readonly region = computed(() => regionFor(this.translate.lang()));
  readonly vocabulary = signal<ExploreVocabulary | null>(null);
  readonly streamingServices = signal<ExploreOption[]>([]);
  private vocabularyRequested = false;
  private streamingRegion: string | null = null;

  load(): void {
    if (!this.vocabularyRequested) {
      this.vocabularyRequested = true;
      this.searchService.vocabulary().subscribe({
        next: (vocabulary) => this.vocabulary.set(vocabulary),
        error: () => (this.vocabularyRequested = false),
      });
    }
    const region = this.region();
    if (this.streamingRegion !== region) {
      this.streamingRegion = region;
      this.searchService.streaming(region).subscribe({
        next: (services) => this.streamingServices.set(services),
        error: () => (this.streamingRegion = null),
      });
    }
  }

  label(criterion: ExploreCriterion): string {
    if (criterionKind(criterion.token) === 'shared') {
      const key = `explore.criteria.${criterion.token}`;
      const label = this.translate.get(key);
      return label === key ? criterion.token : label;
    }
    return criterion.label ?? criterion.token.slice(criterion.token.indexOf(':') + 1);
  }

  typeLabel(type: MediaType): string {
    return this.translate.get(`collection.media_type.${type}`);
  }

  entries(group: ExploreCriterionGroup, type: MediaType | null): ExploreVocabularyEntry[] {
    return (this.vocabulary()?.criteria ?? []).filter(
      (entry) => entry.group === group && (type === null || entry.mediaTypes.includes(type)),
    );
  }

  supports(criterion: ExploreCriterion, type: MediaType): boolean {
    switch (criterionKind(criterion.token)) {
      case 'shared':
        return (
          this.vocabulary()
            ?.criteria.find((entry) => entry.id === criterion.token)
            ?.mediaTypes.includes(type) ?? true
        );
      case 'platform':
        return type === 'game';
      case 'streaming':
        return type === 'movie' || type === 'tv_show';
      case 'catalog':
        return true;
    }
  }

  suggest(text: string, limit = 6): ExploreSuggestion[] {
    const needle = normalizeSearchText(text);
    if (needle.length < 2) return [];
    return [
      ...this.categorySuggestions(needle),
      ...this.criterionSuggestions(needle),
      ...this.optionSuggestions(needle),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.suggestion);
  }

  private categorySuggestions(needle: string): ScoredSuggestion[] {
    return EXPLORE_MEDIA_TYPES.flatMap((type) => {
      const score = matchScore([this.typeLabel(type), ...(CATEGORY_ALIASES[type] ?? [])], needle);
      return score
        ? [
            {
              score: score + 0.5,
              suggestion: { kind: 'category' as const, type, label: this.typeLabel(type) },
            },
          ]
        : [];
    });
  }

  private criterionSuggestions(needle: string): ScoredSuggestion[] {
    return (this.vocabulary()?.criteria ?? []).flatMap((entry) => {
      const criterion = { token: entry.id, label: null };
      const label = this.label(criterion);
      const score = matchScore([label, ...(EXPLORE_ALIASES[entry.id] ?? [])], needle);
      return score
        ? [
            {
              score,
              suggestion: { kind: 'criterion' as const, criterion, label, group: entry.group },
            },
          ]
        : [];
    });
  }

  private optionSuggestions(needle: string): ScoredSuggestion[] {
    const options = [...(this.vocabulary()?.platforms ?? []), ...this.streamingServices()];
    return options.flatMap((option) => {
      const score = matchScore([option.label], needle);
      return score
        ? [
            {
              score: score - 0.25,
              suggestion: {
                kind: 'criterion' as const,
                criterion: { token: option.id, label: option.label },
                label: option.label,
                group: option.group,
              },
            },
          ]
        : [];
    });
  }
}
