import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  signal,
  viewChild,
  type Signal,
} from '@angular/core';
import { CHIP, GROUP_HEADING, SETTINGS_ROWS } from '@shared/ui/ui-recipes';
import { NotificationPreferencesComponent } from './ui/notification-preferences/notification-preferences';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AniListService } from '@app/core/services/anilist/anilist';
import { AuthService } from '@app/core/services/auth/auth';
import type { UnsavedChangesAware } from '@app/core/guards/unsaved-changes-guard';
import { CollectionService } from '@app/core/services/collection/collection';
import type { MediaType } from '@app/core/services/collection/collection.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { IgdbService } from '@app/core/services/igdb/igdb';
import { LegalService } from '@app/core/services/legal/legal';
import { LetterboxdService } from '@app/core/services/letterboxd/letterboxd';
import { SearchService } from '@app/core/services/search/search';
import { SteamService } from '@app/core/services/steam/steam';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { TranslatePipe } from '@app/shared/pipes/translate';
import type { EditBarState } from '@shared/ui/edit-bar/edit-bar';
import type { TabItem } from '@app/shared/ui/tabs/tabs';
import { LayoutService } from '@app/core/services/layout/layout';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { buttonClasses } from '@shared/ui/button/button';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { TabsComponent } from '@shared/ui/tabs/tabs';
import { createPosterWall } from '@shared/utils/poster-wall.util';
import { ToggleComponent } from '@shared/ui/toggle/toggle';
import { createSettingsPage } from './data-access/settings-page';
import { SettingsRowComponent } from '@shared/ui/settings-row/settings-row';
import type { DangerAction } from './state/settings-danger-zone-state';
import { ProfileFormComponent } from './ui/profile-form/profile-form';
import { EmailChangeCardComponent } from './ui/email-change-card/email-change-card';
import { SettingsHeroComponent } from './ui/settings-hero/settings-hero';
import { SteamImportCardComponent } from './ui/steam-import-card/steam-import-card';
import { LetterboxdImportCardComponent } from './ui/letterboxd-import-card/letterboxd-import-card';
import { DangerZoneCardComponent } from './ui/danger-zone-card/danger-zone-card';
import { DangerConfirmDialogComponent } from './ui/danger-confirm-dialog/danger-confirm-dialog';
import { AccountMigrationCardComponent } from './ui/account-migration-card/account-migration-card';
import { PrivacyDataCardComponent } from './ui/privacy-data-card/privacy-data-card';
import { AdultContentConfirmDialogComponent } from './ui/adult-content-confirm-dialog/adult-content-confirm-dialog';
import {
  BannerPickerDialogComponent,
  type BannerCandidate,
  type BannerImage,
  type BannerSelection,
} from '@shared/ui/banner-picker-dialog/banner-picker-dialog';
import { ButtonLinkDirective } from '@shared/ui/button/button-link';

export type SettingsSection =
  'profile' | 'preferences' | 'notifications' | 'connections' | 'account' | 'privacy' | 'danger';

const SECTION_IDS: readonly SettingsSection[] = [
  'profile',
  'preferences',
  'notifications',
  'connections',
  'account',
  'privacy',
  'danger',
];

const SECTION_ALIASES: Record<string, SettingsSection> = {
  data: 'privacy',
};

const SAVED_PAUSE_MS = 700;

@Component({
  selector: 'shelfy-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ButtonLinkDirective,
    AvatarComponent,
    PageHeroComponent,
    PageFooterComponent,
    SpinnerComponent,
    TabsComponent,
    SettingsHeroComponent,
    TranslatePipe,
    ToggleComponent,
    SettingsRowComponent,
    NotificationPreferencesComponent,
    ProfileFormComponent,
    EmailChangeCardComponent,
    SteamImportCardComponent,
    LetterboxdImportCardComponent,
    DangerZoneCardComponent,
    DangerConfirmDialogComponent,
    AccountMigrationCardComponent,
    PrivacyDataCardComponent,
    AdultContentConfirmDialogComponent,
    BannerPickerDialogComponent,
  ],
  templateUrl: './settings.html',
})
export class SettingsPageComponent implements UnsavedChangesAware {
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly dateFormat = inject(DateFormatService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly collection = inject(CollectionService);
  private readonly layout = inject(LayoutService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly barSentinel = viewChild<ElementRef<HTMLElement>>('barSentinel');
  readonly stuck = signal(false);

  readonly use24HourFormat = this.dateFormat.use24Hour;
  readonly row = '';
  readonly toggleRow = 'flex-row! items-center! justify-between! gap-4!';
  readonly rows = SETTINGS_ROWS;
  readonly subTitle = GROUP_HEADING;
  readonly chip = CHIP;
  readonly primary = buttonClasses({ variant: 'primary' });
  readonly wall = createPosterWall();

  toggle24HourFormat(checked: boolean): void {
    this.dateFormat.setUse24Hour(checked);
  }

  private readonly page = createSettingsPage({
    authService: this.authService,
    collectionService: this.collection,
    steamService: inject(SteamService),
    letterboxdService: inject(LetterboxdService),
    searchService: inject(SearchService),
    tmdb: inject(TmdbService),
    igdb: inject(IgdbService),
    aniList: inject(AniListService),
    toastService: this.toastService,
    errorMessage: inject(ErrorMessageService),
    translate: this.translate,
    fb: inject(FormBuilder),
    route: inject(ActivatedRoute),
    router: inject(Router),
    destroyRef: inject(DestroyRef),
  });

  readonly user = this.authService.currentUser;
  readonly gameCovers = this.recentCovers('game');
  readonly movieCovers = this.recentCovers('movie');
  readonly federationEnabled = toSignal(
    inject(LegalService)
      .getInfo()
      .pipe(
        map((info) => info.isFederationEnabled),
        catchError(() => of(false)),
      ),
    { initialValue: false },
  );
  readonly activeSection = signal<SettingsSection>(this.readInitialSection() ?? 'profile');
  readonly tabs = computed<TabItem[]>(() => {
    this.translate.lang();
    return SECTION_IDS.map((id) => ({ id, label: this.translate.get('settings.sections.' + id) }));
  });

  readonly heroName = computed(
    () => this.formValues().displayName || this.formValues().username || this.displayName(),
  );
  readonly displayName = computed(() => {
    const user = this.user();
    return user?.displayName ?? user?.username ?? '';
  });

  readonly form = this.page.profileForm.form;
  readonly usernameError = this.page.profileForm.usernameError;
  readonly displayNameError = this.page.profileForm.displayNameError;
  readonly bioError = this.page.profileForm.bioError;
  readonly allowAdultContent = this.page.profileForm.allowAdultContent;
  readonly federationOptOut = this.page.profileForm.federationOptOut;
  readonly adultContentConfirmDialogOpen = this.page.profileForm.adultContentConfirmDialogOpen;

  private readonly formEvents = toSignal(this.form.events);
  readonly formValues = computed(() => {
    this.formEvents();
    return this.form.getRawValue();
  });
  readonly formValid = computed(() => {
    this.formEvents();
    return !this.form.invalid && !this.form.pending;
  });

  readonly emailForm = this.page.email.form;
  readonly emailSending = this.page.email.sending;
  readonly newEmailError = this.page.email.newEmailError;

  readonly bannerPickerOpen = this.page.banner.pickerOpen;
  readonly bannerQuery = this.page.banner.query;
  readonly bannerResults = this.page.banner.results;
  readonly bannerShelfResults = this.page.banner.shelfResults;
  readonly bannerShelfLoading = this.page.banner.shelfLoading;
  readonly bannerCounts = this.page.banner.counts;
  readonly bannerLoading = this.page.banner.loading;
  readonly bannerLoadingMore = this.page.banner.loadingMore;
  readonly bannerHasMore = this.page.banner.hasMore;
  readonly bannerUnavailableProviders = this.page.banner.unavailableProviders;
  readonly selectedBannerMedia = this.page.banner.selectedMedia;
  readonly bannerImages = this.page.banner.images;
  readonly bannerImagesLoading = this.page.banner.imagesLoading;
  readonly selectedBannerImage = this.page.banner.selectedImage;
  readonly bannerImagePosition = this.page.banner.imagePosition;
  readonly bannerSaving = this.page.banner.saving;

  readonly avatarUploading = this.page.avatar.uploading;
  readonly pendingBanner = this.page.banner.pendingBanner;
  readonly pendingAvatarUrl = this.page.avatar.previewUrl;
  readonly avatarBannerHasChanges = computed(
    () => this.pendingBanner() !== undefined || this.pendingAvatarUrl() !== undefined,
  );
  readonly hasChanges = computed(
    () => this.page.profileForm.hasChanges() || this.avatarBannerHasChanges(),
  );
  readonly saveState = signal<EditBarState>('idle');
  readonly avatarBannerUrl = computed(() => {
    const pending = this.pendingBanner();
    return pending === undefined
      ? (this.user()?.profileBannerUrl ?? null)
      : (pending?.bannerUrl ?? null);
  });
  readonly avatarBannerPosition = computed(() => {
    const pending = this.pendingBanner();
    return pending === undefined
      ? (this.user()?.profileBannerPosition ?? 50)
      : (pending?.position ?? 50);
  });
  readonly avatarUrl = computed(() => {
    const pending = this.pendingAvatarUrl();
    return pending === undefined ? (this.user()?.avatarUrl ?? null) : pending;
  });

  readonly steamConnecting = this.page.steamImport.connecting;
  readonly steamDisconnecting = this.page.steamImport.disconnecting;
  readonly steamImportStarting = this.page.steamImport.importStarting;
  readonly steamImportStatus = this.page.steamImport.importStatus;
  readonly steamImportEntries = this.page.steamImport.importEntries;
  readonly steamImportEntriesLoading = this.page.steamImport.entriesLoading;
  readonly steamImportEntriesExpanded = this.page.steamImport.entriesExpanded;
  readonly steamImportActive = this.page.steamImport.importActive;
  readonly steamImportProgress = this.page.steamImport.importProgress;
  readonly steamImportSkippedEntries = this.page.steamImport.skippedEntries;
  readonly steamImportImportedEntries = this.page.steamImport.importedEntries;

  readonly letterboxdImportStarting = this.page.letterboxdImport.importStarting;
  readonly letterboxdImportStatus = this.page.letterboxdImport.importStatus;
  readonly letterboxdImportEntries = this.page.letterboxdImport.importEntries;
  readonly letterboxdImportEntriesLoading = this.page.letterboxdImport.entriesLoading;
  readonly letterboxdImportEntriesExpanded = this.page.letterboxdImport.entriesExpanded;
  readonly letterboxdImportActive = this.page.letterboxdImport.importActive;
  readonly letterboxdImportProgress = this.page.letterboxdImport.importProgress;
  readonly letterboxdImportSkippedEntries = this.page.letterboxdImport.skippedEntries;
  readonly letterboxdImportImportedEntries = this.page.letterboxdImport.importedEntries;

  readonly dangerConfirmControl = this.page.dangerZone.confirmControl;
  readonly dangerPasswordControl = this.page.dangerZone.passwordControl;
  readonly dangerDialogOpen = this.page.dangerZone.dialogOpen;
  readonly dangerAction = this.page.dangerZone.action;
  readonly dangerBusy = this.page.dangerZone.busy;
  readonly dangerConfirmMatches = this.page.dangerZone.confirmMatches;

  readonly privacyExporting = this.page.privacy.exporting;

  constructor() {
    this.wall.load();
    this.layout.scrollTop.set(0);
    inject(DestroyRef).onDestroy(() => this.layout.scrollTop.set(0));
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const section = this.resolveSection(params.get('section'));
      if (section) this.activeSection.set(section);
    });
  }

  selectSection(id: string): void {
    const section = this.resolveSection(id);
    if (!section) return;
    if (section !== this.activeSection()) this.revealContent();
    this.activeSection.set(section);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  hasUnsavedChanges(): boolean {
    return this.hasChanges() && this.saveState() === 'idle';
  }

  async saveAll(): Promise<void> {
    if (this.saveState() !== 'idle') return;
    if (this.page.profileForm.hasChanges() && !this.formValid()) {
      this.form.markAllAsTouched();
      this.selectSection('profile');
      this.toastService.error(this.translate.get('settings.invalid_hint'));
      return;
    }
    this.saveState.set('saving');
    if (this.page.profileForm.hasChanges()) await this.page.profileForm.save();
    await this.page.avatar.save();
    await this.page.banner.save();
    if (this.hasChanges()) {
      this.saveState.set('idle');
      return;
    }
    this.toastService.success(this.translate.get('settings.saved'));
    this.saveState.set('saved');
    setTimeout(() => this.saveState.set('idle'), SAVED_PAUSE_MS);
  }

  toggleFederationShare(shared: boolean): void {
    void this.page.profileForm.setFederationOptOut(!shared);
  }

  toggleAdultContent(checked: boolean): void {
    void this.page.profileForm.toggleAdultContent(checked);
  }

  confirmAdultContent(): void {
    void this.page.profileForm.confirmAdultContent();
  }

  closeAdultContentConfirmDialog(): void {
    this.page.profileForm.closeAdultContentConfirmDialog();
  }

  requestEmailChange(): void {
    this.page.email.requestChange();
  }

  openBannerPicker(): void {
    this.page.banner.openPicker();
  }

  onScroll(): void {
    const el = this.scrollContainer()?.nativeElement;
    this.layout.scrollTop.set(el?.scrollTop ?? 0);
    const sentinel = this.barSentinel()?.nativeElement;
    if (!el || !sentinel) return;
    const top = sentinel.getBoundingClientRect().top - el.getBoundingClientRect().top;
    this.stuck.set(top < this.navHeight() - 0.5);
  }

  private navHeight(): number {
    return window.innerWidth >= 768
      ? parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-height'),
        ) || 76
      : 0;
  }

  closeBannerPicker(): void {
    this.page.banner.closePicker();
  }

  onBannerQueryChange(query: string): void {
    this.page.banner.onQueryChange(query);
  }

  loadMoreBannerResults(): void {
    this.page.banner.loadMoreResults();
  }

  requestBannerCount(candidate: BannerCandidate): void {
    this.page.banner.requestCount(candidate);
  }

  selectBannerMedia(candidate: BannerCandidate): void {
    this.page.banner.selectMedia(candidate);
  }

  backToBannerSearch(): void {
    this.page.banner.backToSearch();
  }

  selectBannerImage(image: BannerImage): void {
    this.page.banner.selectImage(image);
  }

  setBannerImagePosition(position: number): void {
    this.page.banner.setImagePosition(position);
  }

  confirmBannerImage(selection: BannerSelection): void {
    this.page.banner.confirmImage(selection);
  }

  removeBanner(): void {
    this.page.banner.clearBanner();
  }

  removeBannerFromPicker(): void {
    this.page.banner.clearBanner();
    this.closeBannerPicker();
  }

  uploadAvatar(file: File): void {
    this.page.avatar.upload(file);
  }

  removeAvatar(): void {
    this.page.avatar.remove();
  }

  connectSteam(): void {
    this.page.steamImport.connect();
  }

  disconnectSteam(): void {
    this.page.steamImport.disconnect();
  }

  startSteamImport(): void {
    this.page.steamImport.startImport();
  }

  toggleImportEntries(): void {
    this.page.steamImport.toggleEntries();
  }

  startLetterboxdImport(file: File): void {
    this.page.letterboxdImport.startImport(file);
  }

  toggleLetterboxdImportEntries(): void {
    this.page.letterboxdImport.toggleEntries();
  }

  openDangerDialog(action: DangerAction): void {
    this.page.dangerZone.openDialog(action);
  }

  closeDangerDialog(): void {
    this.page.dangerZone.closeDialog();
  }

  confirmDangerAction(): void {
    this.page.dangerZone.confirmAction();
  }

  exportData(): void {
    this.page.privacy.exportData();
  }

  private revealContent(): void {
    const container = this.scrollContainer()?.nativeElement;
    const sentinel = this.barSentinel()?.nativeElement;
    if (!container || !sentinel) return;
    const top =
      container.scrollTop +
      sentinel.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      this.navHeight();
    if (container.scrollTop > top) container.scrollTop = top;
  }

  private resolveSection(id: string | null): SettingsSection | null {
    if (!id) return null;
    if ((SECTION_IDS as readonly string[]).includes(id)) return id as SettingsSection;
    return SECTION_ALIASES[id] ?? null;
  }

  private readInitialSection(): SettingsSection | null {
    const params = this.route.snapshot.queryParamMap;
    const requested = this.resolveSection(params.get('section'));
    if (requested) return requested;
    return params.get('steam') ? 'connections' : null;
  }

  private recentCovers(mediaType: MediaType): Signal<string[]> {
    return toSignal(
      this.collection.list({ mediaType: [mediaType], size: 3 }).pipe(
        map((page) =>
          page.content.map((item) => item.media.coverUrl).filter((url): url is string => !!url),
        ),
        catchError(() => of([])),
      ),
      { initialValue: [] },
    );
  }
}
