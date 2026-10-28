import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { MediaType } from '@app/core/services/collection/collection.model';
import { SearchService } from '@app/core/services/search/search';
import {
  ExploreCatalogService,
  normalizeSearchText,
  type ExploreSuggestion,
} from '@app/core/services/search/explore-catalog';
import {
  MAX_EXPLORE_CRITERIA,
  type ExploreCriterion,
  type ExploreQuery,
} from '@app/core/services/search/explore-query';
import type { ExploreOption } from '@app/core/services/search/search.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import type { IconName } from '@shared/ui/icon/icon-registry';
import { MENU_PANEL, SEARCH_FIELD, SEARCH_FIELD_LARGE, TOOLBAR_FIELD } from '@shared/ui/ui-recipes';
import { MEDIA_TYPE_ICON } from '@shared/utils/media-type-icon.util';

const CATALOG_DEBOUNCE_MS = 260;
const CATALOG_LIMIT = 6;

type OmniboxOption =
  | { id: string; kind: 'suggestion'; suggestion: ExploreSuggestion }
  | { id: string; kind: 'catalog'; option: ExploreOption }
  | { id: string; kind: 'text' };

export interface ExploreChip {
  criterion: ExploreCriterion;
  excluded: boolean;
}

@Component({
  selector: 'shelfy-explore-omnibox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  host: {
    class: 'relative block min-w-0',
    '(focusout)': 'onFocusOut($event)',
  },
  templateUrl: './explore-omnibox.html',
})
export class ExploreOmniboxComponent {
  private readonly searchService = inject(SearchService);
  private readonly translate = inject(TranslateService);
  readonly catalog = inject(ExploreCatalogService);

  readonly query = input.required<ExploreQuery>();
  readonly compact = input(false);
  readonly showChips = input(true);
  readonly omni = input(false);
  readonly added = output<ExploreCriterion>();
  readonly removed = output<ExploreChip>();
  readonly textChanged = output<string>();
  readonly typePicked = output<MediaType>();

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  readonly draft = signal('');
  readonly open = signal(false);
  readonly activeIndex = signal(-1);
  readonly catalogOptions = signal<ExploreOption[]>([]);
  readonly menuPanel = MENU_PANEL;
  readonly fieldClass = computed(() => {
    if (this.omni()) return 'omnibox';
    if (this.compact()) return TOOLBAR_FIELD;
    return this.showChips()
      ? `${SEARCH_FIELD} h-auto min-h-13 py-1.5 pr-1.5 pl-4 max-sm:[scrollbar-width:none] max-sm:overflow-x-auto sm:flex-wrap [&::-webkit-scrollbar]:hidden`
      : `${SEARCH_FIELD_LARGE} gap-3 pr-3 pl-4.5`;
  });

  readonly placeholderKey = computed(() =>
    this.showChips() && (this.chips().length || this.query().text)
      ? 'explore.add_placeholder'
      : 'explore.placeholder',
  );
  readonly listboxId = 'explore-omnibox-listbox';

  readonly chips = computed<ExploreChip[]>(() => [
    ...this.query().with.map((criterion) => ({ criterion, excluded: false })),
    ...this.query().without.map((criterion) => ({ criterion, excluded: true })),
  ]);
  private readonly tokenCount = computed(() => this.chips().length + (this.query().text ? 1 : 0));
  readonly full = computed(
    () => this.query().with.length + this.query().without.length >= MAX_EXPLORE_CRITERIA,
  );
  private readonly activeTokens = computed(
    () => new Set(this.chips().map((chip) => chip.criterion.token)),
  );
  readonly suggestions = computed(() =>
    this.catalog
      .suggest(this.draft(), 6)
      .filter(
        (suggestion) =>
          suggestion.kind === 'category' || !this.activeTokens().has(suggestion.criterion.token),
      ),
  );
  private readonly suggestedLabels = computed(
    () => new Set(this.suggestions().map((suggestion) => normalizeSearchText(suggestion.label))),
  );
  readonly options = computed<OmniboxOption[]>(() => {
    if (!this.draft().trim()) return [];
    return [
      ...this.suggestions().map((suggestion, index) => ({
        id: `explore-suggestion-${index}`,
        kind: 'suggestion' as const,
        suggestion,
      })),
      ...this.catalogOptions()
        .filter(
          (option) =>
            !this.activeTokens().has(option.id) &&
            !this.suggestedLabels().has(normalizeSearchText(option.label)),
        )
        .slice(0, CATALOG_LIMIT)
        .map((option, index) => ({
          id: `explore-catalog-${index}`,
          kind: 'catalog' as const,
          option,
        })),
      { id: 'explore-text', kind: 'text' as const },
    ];
  });
  readonly activeId = computed(() => this.options()[this.activeIndex()]?.id ?? null);
  readonly expanded = computed(() => this.open() && this.options().length > 0);

  constructor() {
    afterRenderEffect(() => {
      if (this.showChips()) return;
      const text = this.query().text;
      untracked(() => this.setDraft(text));
    });

    afterRenderEffect(() => {
      const count = this.tokenCount();
      const track = this.track().nativeElement;
      if (count && track.contains(document.activeElement)) track.scrollLeft = track.scrollWidth;
    });

    effect((onCleanup) => {
      const text = this.draft().trim();
      const type = this.query().type;
      this.activeIndex.set(-1);
      this.catalogOptions.set([]);
      if (!type || text.length < 2) return;
      const timer = setTimeout(() => {
        const subscription = this.searchService.catalogOptions(type, text).subscribe({
          next: (options) => this.catalogOptions.set(options),
          error: () => this.catalogOptions.set([]),
        });
        onCleanup(() => subscription.unsubscribe());
      }, CATALOG_DEBOUNCE_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  focus(): void {
    this.input().nativeElement.focus();
    const track = this.track().nativeElement;
    track.scrollLeft = track.scrollWidth;
  }

  onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value.slice(0, 120));
    this.open.set(true);
    if (!this.showChips() && !this.draft().trim() && this.query().text) this.textChanged.emit('');
  }

  onFocus(): void {
    if (this.showChips()) this.open.set(true);
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.options().length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.open.set(true);
      this.activeIndex.set((this.activeIndex() + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.activeIndex.set(this.activeIndex() <= 0 ? count - 1 : this.activeIndex() - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = this.options()[this.activeIndex()];
      if (option) this.activate(option);
      else if (this.draft().trim()) this.applyText();
    } else if (event.key === 'Escape' && this.expanded()) {
      event.preventDefault();
      event.stopPropagation();
      this.open.set(false);
    } else if (event.key === 'Backspace' && !this.draft() && this.showChips()) {
      const chips = this.chips();
      if (chips.length) this.removed.emit(chips[chips.length - 1]);
      else if (this.query().text) this.textChanged.emit('');
    }
  }

  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !(event.currentTarget as HTMLElement).contains(next)) this.open.set(false);
  }

  activate(option: OmniboxOption): void {
    if (option.kind === 'text') {
      this.applyText();
    } else if (option.kind === 'catalog') {
      this.add({ token: option.option.id, label: option.option.label });
    } else if (option.suggestion.kind === 'category') {
      this.typePicked.emit(option.suggestion.type);
      this.reset();
    } else {
      this.add(option.suggestion.criterion);
    }
  }

  optionIndex(id: string): number {
    return this.options().findIndex((option) => option.id === id);
  }

  suggestionIcon(suggestion: ExploreSuggestion): IconName {
    if (suggestion.kind === 'category') return MEDIA_TYPE_ICON[suggestion.type];
    if (suggestion.group === 'platform') return 'game';
    if (suggestion.group === 'streaming') return 'play';
    return suggestion.group === 'theme' ? 'discover' : 'grid';
  }

  suggestionHint(suggestion: ExploreSuggestion): string {
    return this.translate.get(
      suggestion.kind === 'category' ? 'explore.kind.category' : `explore.kind.${suggestion.group}`,
    );
  }

  catalogHint(option: ExploreOption): string {
    return this.translate.get(`explore.kind.${option.group}`);
  }

  chipLabel(chip: ExploreChip): string {
    const label = this.catalog.label(chip.criterion);
    return chip.excluded ? `${this.translate.get('explore.without')} ${label}` : label;
  }

  private add(criterion: ExploreCriterion): void {
    if (!this.full()) this.added.emit(criterion);
    this.reset();
  }

  private applyText(): void {
    this.textChanged.emit(this.draft().trim());
    if (this.showChips()) this.reset();
    else this.closeList();
  }

  private reset(): void {
    this.setDraft(this.showChips() ? '' : this.query().text);
    this.closeList();
  }

  private setDraft(text: string): void {
    this.draft.set(text);
    this.input().nativeElement.value = text;
  }

  private closeList(): void {
    this.activeIndex.set(-1);
    this.open.set(false);
    this.focus();
  }
}
