export const CHEVRON =
  'flex shrink-0 items-center leading-none opacity-60 transition-transform duration-base';

export const MENU_PANEL =
  'bg-surface-raised shadow-overlay animate-pop-in absolute top-[calc(100%+8px)] z-30 min-w-[220px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-popover p-3';

export const MENU_ITEM =
  'text-text/90 hover:text-text hover:bg-fill-subtle flex h-13 w-full cursor-pointer items-center gap-3.5 rounded-2xl px-3.5 text-left text-base font-semibold whitespace-nowrap transition-[color,background-color] duration-slow ease-expo';

export const MENU_SEPARATOR = 'my-1.5 border-0';

export const SEARCH_FIELD =
  'bg-white/8 rounded-2xl duration-base transition-[background-color,box-shadow] hover:bg-white/11 focus-within:bg-white/12 focus-within:shadow-[0_0_0_2px_rgb(230_211_179/0.5)]';
export const SEARCH_FIELD_LARGE = `${SEARCH_FIELD} h-13`;

export const MEDIA_CHIP = 'bg-media-chip shadow-chip backdrop-blur-[14px] backdrop-saturate-140';

export const HIT_AREA_40 =
  'relative after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-1/2';

const COLLAPSE_BASE =
  'grid transition-[grid-template-rows,opacity] duration-base motion-reduce:transition-none';

export const collapse = (open: boolean, fade = true): string =>
  open
    ? `${COLLAPSE_BASE} grid-rows-[1fr] opacity-100`
    : `${COLLAPSE_BASE} grid-rows-[0fr] ${fade ? 'opacity-0' : 'opacity-100'}`;

export const staggerDelay = (index: number): number => (index < 12 ? index * 30 : 0);

export const CARD_LIFT =
  'shadow-poster ease-expo transition-[translate,box-shadow] duration-700 group-hover/card:shadow-poster-hover group-has-[:focus-visible]/card:shadow-poster-hover motion-safe:group-hover/card:-translate-y-1.5 motion-safe:group-has-[:focus-visible]/card:-translate-y-1.5 motion-reduce:transition-none';

export const CHECKBOX =
  'grid size-4.5 place-items-center rounded-xs transition-[background-color,box-shadow,scale] active:scale-90';
export const CHECKBOX_ON = 'bg-text text-background';
export const CHECKBOX_OFF = 'inset-shadow-control';

export const FLOATING_BAR =
  'bg-surface-raised text-text shadow-float fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-xl items-center rounded-xl md:bottom-6';

export const BULK_BAR = FLOATING_BAR + ' gap-1 p-2';

export type PosterSize = 's' | 'm' | 'l';

export const POSTER_GRID: Record<PosterSize, string> = {
  s: 'grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-x-3 gap-y-5.5 md:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] md:gap-x-3.5',
  m: 'grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-x-3 gap-y-6 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:gap-x-5 md:gap-y-7.5',
  l: 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-6 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-x-5 md:gap-y-7.5',
};

export const TOOLBAR_BUTTON = 'v-tool shrink-0 aria-pressed:text-text';
export const FILTER_TILE =
  'inline-flex h-11 cursor-pointer items-center gap-2.25 rounded-[0.875rem] px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color,color] duration-slow ease-expo';
export const FILTER_TILE_ON =
  'bg-white/16 text-text before:size-2 before:shrink-0 before:rounded-full before:bg-accent';
export const FILTER_TILE_OFF = 'bg-white/8 text-text-muted hover:bg-white/12 hover:text-text';
export const FILTER_GROUP_TITLE = 'text-text-subtle mb-3 text-[0.8125rem] font-semibold';
export const TOOLBAR_FIELD = `${SEARCH_FIELD} text-text-subtle flex h-13 min-w-0 flex-1 items-center gap-2.5 px-4`;

export const PANEL_BUTTON =
  'bg-button-secondary text-text hover:bg-button-secondary-hover flex h-13 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-2xl px-5.5 text-base font-semibold transition-[background-color,scale] active:scale-97';
export const SECTION_TITLE =
  'font-display text-text mb-4 text-[1.5rem] leading-[1.05] font-extrabold tracking-[-0.04em]';
export const PANEL_HEADING = 'text-text text-[1.0625rem] font-semibold';
export const GROUP_HEADING =
  'font-display text-text mb-4 text-[1.5rem] leading-[1.05] font-extrabold tracking-[-0.04em]';
export const SETTINGS_TILE = 'rounded-[18px] bg-white/6 px-5 py-4.5';
export const SETTINGS_ROWS = 'flex flex-col gap-2 *:rounded-[18px] *:bg-white/6 *:px-5 *:py-4.5';
export const CREATION_CARD_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-x-5 gap-y-8';
export const CHIP =
  'inline-flex h-13 shrink-0 cursor-pointer items-center gap-2 rounded-2xl px-4.5 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors';
export const CHIP_ON = 'bg-white/16 text-text';
export const CHIP_OFF = 'bg-white/8 text-text-muted hover:bg-white/12 hover:text-text';
export const TAG_CHIP =
  'text-text inline-flex h-9 shrink-0 items-center gap-1 rounded-[0.625rem] bg-white/8 px-3 text-sm font-semibold whitespace-nowrap';
export const TAG_CHIP_ADD =
  'text-text-muted hover:text-text focus-within:text-text inline-flex h-9 cursor-text items-center gap-1.5 rounded-[0.625rem] px-3 text-sm font-semibold shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)] transition-[color,box-shadow] focus-within:shadow-[inset_0_0_0_1px_rgb(230_211_179/0.6)]';
