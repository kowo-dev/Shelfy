import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AmbientService } from '@app/core/services/ambient/ambient';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { IconComponent } from '@shared/ui/icon/icon';
import { buttonClasses } from '@shared/ui/button/button';
import { formatRating, ratingToTextColor } from '@shared/utils/collection-rating.util';
import { artKey } from '../../data-access/home-art';
import type { HomeSlide } from '../../data-access/home-discovery';

const SWIPE_PX = 40;
const VISIBLE_SIDE = 2;
const RENDERED_SIDE = VISIBLE_SIDE * 2;

function plainText(value: string): string | null {
  const text = value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

@Component({
  selector: 'shelfy-home-stage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IconComponent],
  templateUrl: './home-stage.html',
  host: { class: 'block' },
})
export class HomeStageComponent {
  private readonly ambient = inject(AmbientService);
  private readonly lookup = inject(ShelfLookupService);
  private readonly router = inject(Router);

  kicker = input.required<string>();
  slide = input.required<HomeSlide>();
  slides = input<HomeSlide[]>([]);
  wall = input<string[]>([]);

  readonly shelve = output<CollectionItemResponse>();
  readonly edit = output<CollectionItemResponse>();
  readonly activeChange = output<string | null>();

  protected readonly primaryClass = buttonClasses({
    variant: 'primary',
    extraClass: 'gap-2.5',
  });
  protected readonly glassClass = buttonClasses({
    variant: 'secondary',
    extraClass: 'gap-2.5',
  });

  private readonly index = signal(0);
  private readonly epoch = signal(0);
  private readonly arriving = signal(true);
  private swipeStart: number | null = null;
  private swiped = false;

  readonly deck = computed(() => {
    const slides = this.slides();
    return slides.length ? slides : [this.slide()];
  });

  private readonly at = (slot: number) => {
    const deck = this.deck();
    return deck[((slot % deck.length) + deck.length) % deck.length];
  };

  readonly active = computed(() => this.at(this.index()) ?? this.slide());

  readonly cards = computed(() => {
    const index = this.index();
    const epoch = this.epoch();
    const arriving = this.arriving();
    const side = this.deck().length > 1 ? RENDERED_SIDE : 0;
    return Array.from({ length: side * 2 + 1 }, (_, i) => {
      const slot = index - side + i;
      const offset = slot - index;
      const away = Math.abs(offset);
      const slide = this.at(slot);
      return {
        key: `${epoch}:${slot}`,
        slot,
        title: slide.item.media.title,
        cover: slide.item.media.coverUrl,
        away,
        enter: arriving ? 'animate-card-in' : '',
        stagger: 60 + away * 70,
        hidden: away > VISIBLE_SIDE,
        transform: `translate(-50%, -50%) translateX(${offset * 44}%) scale(${1 - Math.min(away, 3) * 0.17})`,
      };
    });
  });

  private readonly tints = signal<ReadonlyMap<string, string>>(new Map());

  readonly layers = computed(() => {
    const slide = this.active();
    const key = artKey(slide.item);
    return [
      {
        key,
        art: slide.art,
        cover: slide.item.media.coverUrl,
        tint: this.tints().get(key) ?? null,
      },
    ];
  });

  readonly copy = computed(() => {
    const slide = this.active();
    const { media } = slide.item;
    const date = media.metadata?.['releaseDate'];
    const owned = this.lookup.find(media);
    const rating = slide.item.rating;
    return {
      key: artKey(slide.item),
      item: slide.item,
      owned,
      title: media.title,
      long: media.title.length > 24,
      overview:
        typeof media.metadata?.['overview'] === 'string'
          ? plainText(media.metadata['overview'])
          : null,
      route: ['/media', media.mediaType, media.externalId],
      genres: Array.isArray(media.metadata?.['genres'])
        ? (media.metadata['genres'] as unknown[])
            .filter((genre): genre is string => typeof genre === 'string')
            .slice(0, 2)
        : [],
      typeKey: 'collection.media_type_one.' + media.mediaType,
      year: typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : null,
      rating: rating === null ? null : formatRating(rating),
      mine:
        owned?.rating == null
          ? null
          : { text: formatRating(owned.rating), color: ratingToTextColor(owned.rating, 100) },
    };
  });

  constructor() {
    effect(() => {
      const deck = this.deck();
      const start = this.slide();
      untracked(() => {
        this.epoch.update((epoch) => epoch + 1);
        this.arriving.set(true);
        this.index.set(
          Math.max(
            0,
            deck.findIndex((slide) => artKey(slide.item) === artKey(start.item)),
          ),
        );
      });
    });

    effect(() => this.lookup.request(this.active().item.media));

    effect(() => {
      const slide = this.active();
      const url = slide.art?.wide ?? slide.item.media.coverUrl;
      untracked(() => this.activeChange.emit(url));
    });

    effect(() => {
      const slide = this.active();
      const cover = slide.item.media.coverUrl;
      const key = artKey(slide.item);
      if (slide.art || !cover || untracked(this.tints).has(key)) return;
      void this.ambient.colorOf(cover).then((color) => {
        if (color) this.tints.update((known) => new Map(known).set(key, color));
      });
    });

    inject(DestroyRef).onDestroy(() => this.activeChange.emit(null));
  }

  go(step: number): void {
    if (this.deck().length > 1) this.moveTo(this.index() + step);
  }

  pick(slot: number): void {
    if (this.swiped) return;
    if (slot !== this.index()) {
      this.moveTo(slot);
      return;
    }
    void this.router.navigate(this.copy().route);
  }

  private moveTo(slot: number): void {
    this.arriving.set(false);
    this.index.set(slot);
  }

  onKeydown(event: KeyboardEvent): void {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    this.go(step);
  }

  swipeFrom(event: PointerEvent): void {
    this.swipeStart = event.clientX;
    this.swiped = false;
  }

  swipeTo(event: PointerEvent): void {
    if (this.swipeStart === null) return;
    const distance = event.clientX - this.swipeStart;
    this.swipeStart = null;
    if (Math.abs(distance) <= SWIPE_PX) return;
    this.swiped = true;
    this.go(distance < 0 ? 1 : -1);
    setTimeout(() => (this.swiped = false));
  }

  primary(): void {
    const copy = this.copy();
    if (copy.owned) this.edit.emit(copy.owned);
    else this.shelve.emit(copy.item);
  }
}
