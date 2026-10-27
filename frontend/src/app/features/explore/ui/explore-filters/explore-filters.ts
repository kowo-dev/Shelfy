import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { environment } from '@env';
import { SearchService } from '@app/core/services/search/search';
import { ExploreCatalogService } from '@app/core/services/search/explore-catalog';
import type { ExploreCriterion, ExploreQuery } from '@app/core/services/search/explore-query';
import type { ExploreOption } from '@app/core/services/search/search.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { TranslateService } from '@app/core/services/translate/translate';

const CATALOG_PREVIEW = 30;
const CATALOG_DEBOUNCE_MS = 260;
const CURRENT_YEAR = new Date().getFullYear();

export type ExploreFacet = 'genre' | 'theme' | 'period' | 'where' | 'tag';

export type CriterionState = 'include' | 'exclude' | 'off';

type FilterSection = 'genre' | 'theme' | 'period' | 'streaming' | 'platforms' | 'tag';

export interface YearRange {
  from: number | null;
  to: number | null;
}

interface Decade {
  key: string;
  from: number | null;
  to: number | null;
}

const DECADES: Decade[] = [
  { key: 'before_1980', from: null, to: 1979 },
  { key: '1980s', from: 1980, to: 1989 },
  { key: '1990s', from: 1990, to: 1999 },
  { key: '2000s', from: 2000, to: 2009 },
  { key: '2010s', from: 2010, to: 2019 },
  { key: '2020s', from: 2020, to: null },
];

import {
  FILTER_GROUP_TITLE,
  FILTER_TILE,
  FILTER_TILE_OFF,
  FILTER_TILE_ON,
} from '@shared/ui/ui-recipes';

@Component({
  selector: 'shelfy-explore-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe, NgTemplateOutlet],
  templateUrl: './explore-filters.html',
  host: { class: 'block' },
})
export class ExploreFiltersComponent {
  private readonly searchService = inject(SearchService);
  private readonly translate = inject(TranslateService);
  readonly catalog = inject(ExploreCatalogService);

  readonly query = input.required<ExploreQuery>();
  readonly facet = input<ExploreFacet | null>(null);

  readonly cycled = output<{ criterion: ExploreCriterion; state: CriterionState }>();
  readonly yearsChanged = output<YearRange>();
  readonly cleared = output<void>();

  readonly decades = DECADES;
  readonly currentYear = CURRENT_YEAR;
  readonly catalogQuery = signal('');
  readonly catalogOptions = signal<ExploreOption[]>([]);
  readonly catalogLoading = signal(false);

  readonly genres = computed(() => this.catalog.entries('genre', this.query().type));
  readonly themes = computed(() => this.catalog.entries('theme', this.query().type));
  readonly showStreaming = computed(() => {
    const type = this.query().type;
    return (
      (type === null || type === 'movie' || type === 'tv_show') &&
      this.catalog.streamingServices().length > 0
    );
  });
  readonly streaming = computed(() => this.catalog.streamingServices());
  readonly showPlatforms = computed(() => {
    const type = this.query().type;
    return type === null || type === 'game';
  });
  readonly platforms = computed(() => this.catalog.vocabulary()?.platforms ?? []);
  readonly catalogSelections = computed(() =>
    [...this.query().with, ...this.query().without].filter((criterion) =>
      /^(tmdb|anilist|igdb)-/.test(criterion.token),
    ),
  );
  private readonly toggled = signal<Partial<Record<FilterSection, boolean>>>({});
  private readonly openByDefault = computed<Record<FilterSection, boolean>>(() => {
    const query = this.query();
    const tokens = new Set([...query.with, ...query.without].map((criterion) => criterion.token));
    const any = (options: { id: string }[]) => options.some((option) => tokens.has(option.id));
    return {
      genre: true,
      theme: any(this.themes()),
      period: true,
      streaming: true,
      platforms: true,
      tag: this.catalogSelections().length > 0,
    };
  });

  constructor() {
    effect((onCleanup) => {
      const type = this.query().type;
      const text = this.catalogQuery().trim();
      this.catalogOptions.set([]);
      if (!type) {
        this.catalogLoading.set(false);
        return;
      }
      this.catalogLoading.set(true);
      const timer = setTimeout(
        () => {
          const subscription = this.searchService.catalogOptions(type, text).subscribe({
            next: (options) => {
              this.catalogOptions.set(options.slice(0, CATALOG_PREVIEW));
              this.catalogLoading.set(false);
            },
            error: () => this.catalogLoading.set(false),
          });
          onCleanup(() => subscription.unsubscribe());
        },
        text ? CATALOG_DEBOUNCE_MS : 0,
      );
      onCleanup(() => clearTimeout(timer));
    });
  }

  state(token: string): CriterionState {
    const query = this.query();
    if (query.with.some((criterion) => criterion.token === token)) return 'include';
    if (query.without.some((criterion) => criterion.token === token)) return 'exclude';
    return 'off';
  }

  cycle(criterion: ExploreCriterion, allowExclude = true): void {
    const current = this.state(criterion.token);
    const next: CriterionState =
      current === 'off' ? 'include' : current === 'include' && allowExclude ? 'exclude' : 'off';
    this.cycled.emit({ criterion, state: next });
  }

  shared(id: string): ExploreCriterion {
    return { token: id, label: null };
  }

  option(option: ExploreOption): ExploreCriterion {
    return { token: option.id, label: option.label };
  }

  decadeActive(decade: Decade): boolean {
    const query = this.query();
    return query.from === decade.from && query.to === decade.to;
  }

  pickDecade(decade: Decade): void {
    this.yearsChanged.emit(
      this.decadeActive(decade) ? { from: null, to: null } : { from: decade.from, to: decade.to },
    );
  }

  setYear(edge: 'from' | 'to', event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (!Number.isInteger(value) || value < 1870 || value > CURRENT_YEAR + 5)) {
      return;
    }
    const query = this.query();
    this.yearsChanged.emit({
      from: edge === 'from' ? value : query.from,
      to: edge === 'to' ? value : query.to,
    });
  }

  logo(option: ExploreOption): string | null {
    return option.logoPath ? `${environment.tmdbImageBaseUrl}w92${option.logoPath}` : null;
  }

  protected readonly groupTitle = FILTER_GROUP_TITLE;

  rowClass(state: CriterionState): string {
    if (state === 'include') return `${FILTER_TILE} ${FILTER_TILE_ON}`;
    if (state === 'exclude') return `${FILTER_TILE} bg-white/5 text-text-subtle line-through`;
    return `${FILTER_TILE} ${FILTER_TILE_OFF}`;
  }

  isOpen(section: FilterSection): boolean {
    return this.toggled()[section] ?? this.openByDefault()[section];
  }

  toggle(section: FilterSection): void {
    this.toggled.update((toggled) => ({ ...toggled, [section]: !this.isOpen(section) }));
  }

  show(facet: ExploreFacet): boolean {
    const current = this.facet();
    return current === null || current === facet;
  }

  ariaLabel(criterion: ExploreCriterion): string {
    const label = this.catalog.label(criterion);
    const state = this.state(criterion.token);
    return state === 'exclude' ? `${this.translate.get('explore.without')} ${label}` : label;
  }
}
