import { buttonClasses } from '@shared/ui/button/button';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button';
import { FormsModule } from '@angular/forms';
import type { SearchResult } from '@app/core/services/search/search.model';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { DialogComponent } from '@shared/ui/dialog/dialog';
import { SearchbarComponent } from '@shared/ui/searchbar/searchbar';
import { InViewDirective } from './in-view';
import { ScrollTopComponent } from '@shared/ui/scroll-top/scroll-top';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { IconComponent } from '@shared/ui/icon/icon';
import { MEDIA_CHIP, staggerDelay } from '@shared/ui/ui-recipes';

export interface BannerCandidate {
  result: SearchResult;
  coverUrl: string | null;
}

export function bannerKey(candidate: BannerCandidate): string {
  const { provider, mediaType, externalId } = candidate.result;
  return `${provider}:${mediaType}:${externalId}`;
}

export interface BannerImage {
  url: string;
  label: string;
}

export interface BannerSelection {
  url: string;
  position: number;
}

@Component({
  selector: 'shelfy-banner-picker-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:resize)': 'onResize()',
  },
  imports: [
    ButtonComponent,
    FormsModule,
    TranslatePipe,
    DialogComponent,
    SearchbarComponent,
    IconComponent,
    AvatarComponent,
    ScrollTopComponent,
    InViewDirective,
    NgTemplateOutlet,
  ],
  templateUrl: './banner-picker-dialog.html',
})
export class BannerPickerDialogComponent {
  protected readonly secondarySmall = buttonClasses({
    variant: 'secondary',
    size: 'sm',
    extraClass: 'shrink-0',
  });
  protected readonly staggerDelay = staggerDelay;

  query = input.required<string>();
  results = input.required<BannerCandidate[]>();
  shelfResults = input<BannerCandidate[]>([]);
  shelfLoading = input(false);
  displayName = input('');
  username = input('');
  avatarUrl = input<string | null>(null);
  bannerCounts = input<Record<string, number>>({});
  currentBannerUrl = input<string | null>(null);
  currentPosition = input(50);
  loading = input.required<boolean>();
  loadingMore = input.required<boolean>();
  hasMore = input.required<boolean>();
  unavailableProviders = input.required<string[]>();
  selectedMedia = input<BannerCandidate | null>(null);
  images = input.required<BannerImage[]>();
  imagesLoading = input.required<boolean>();
  saving = input.required<boolean>();
  hasBanner = input(false);
  selectedImage = input<BannerImage | null>(null);
  imagePosition = input(50);
  title = input<string | null>(null);
  searchPlaceholder = input<string | null>(null);
  previewTitle = input<string | null>(null);
  aspect = input<number | null>(null);
  autoOption = input(false);
  autoActive = input(false);
  autoLabel = input('');
  autoHint = input('');

  closed = output<void>();
  removeBanner = output<void>();
  queryChange = output<string>();
  mediaSelected = output<BannerCandidate>();
  countRequested = output<BannerCandidate>();
  loadMore = output<void>();
  backToSearch = output<void>();
  imageSelected = output<BannerImage>();
  imagePositionChange = output<number>();
  imageConfirmed = output<BannerSelection>();
  autoChosen = output<void>();

  protected readonly previewUrl = computed(
    () => this.selectedImage()?.url ?? this.currentBannerUrl(),
  );
  protected readonly previewPosition = computed(() =>
    this.selectedImage() ? this.imagePosition() : this.currentPosition(),
  );
  protected readonly ratio = signal(heroRatio());
  protected readonly previewRatio = computed(() => this.aspect() ?? this.ratio());

  protected onResize(): void {
    this.ratio.set(heroRatio());
  }

  protected readonly bannerKey = bannerKey;
  protected readonly chip = MEDIA_CHIP;

  protected readonly skeletons = [0, 1, 2, 3, 4, 5];

  private drag: {
    pointerId: number;
    startY: number;
    startPosition: number;
    height: number;
  } | null = null;

  onImagePointerDown(event: PointerEvent): void {
    if (!this.selectedImage() || (event.target as HTMLElement).closest('button')) return;
    const container = event.currentTarget as HTMLElement;
    container.setPointerCapture(event.pointerId);
    this.drag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startPosition: this.imagePosition(),
      height: container.clientHeight,
    };
  }

  onImagePointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId || drag.height === 0) return;
    const deltaPercent = ((event.clientY - drag.startY) / drag.height) * 100;
    const next = Math.max(0, Math.min(100, Math.round(drag.startPosition - deltaPercent)));
    this.imagePositionChange.emit(next);
  }

  onImagePointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) {
      this.drag = null;
    }
  }

  onPreviewKeydown(event: KeyboardEvent): void {
    if (!this.selectedImage()) return;
    const step = event.shiftKey ? 15 : 5;
    const delta = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    if (delta === 0) return;
    event.preventDefault();
    this.imagePositionChange.emit(Math.max(0, Math.min(100, this.imagePosition() + delta)));
  }
}

function heroRatio(): number {
  const width = window.innerWidth;
  const compact = width < 640;
  const height = compact ? 300 : Math.min(560, Math.max(420, window.innerHeight * 0.55));
  const content = compact ? width : width - 288;
  return Math.max(1.3, Math.min(3.4, content / height));
}
