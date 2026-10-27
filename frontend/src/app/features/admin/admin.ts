import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, type Observable } from 'rxjs';
import { ApiError } from '@app/core/errors/api-error';
import { FederationAdminService } from '@app/core/services/admin/federation-admin';
import type {
  FederationOverview,
  FederationReport,
  KnownInstance,
} from '@app/core/services/admin/federation-admin.model';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import type { TabItem } from '@app/shared/ui/tabs/tabs';
import { LayoutService } from '@app/core/services/layout/layout';
import { ButtonComponent } from '@shared/ui/button/button';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { IconComponent } from '@shared/ui/icon/icon';
import { PageFooterComponent } from '@shared/ui/page-footer/page-footer';
import { PageHeroComponent } from '@shared/ui/page-hero/page-hero';
import { SettingsRowComponent } from '@shared/ui/settings-row/settings-row';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { TabsComponent } from '@shared/ui/tabs/tabs';
import { createPosterWall } from '@shared/utils/poster-wall.util';
import { SETTINGS_ROWS, SETTINGS_TILE } from '@shared/ui/ui-recipes';

type LoadState = 'loading' | 'ready' | 'forbidden' | 'error';

export type AdminSection = 'federation' | 'instances' | 'blocks' | 'allows' | 'reports';

const SECTION_IDS: readonly AdminSection[] = [
  'federation',
  'instances',
  'blocks',
  'allows',
  'reports',
];

@Component({
  selector: 'shelfy-admin-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonComponent,
    AvatarComponent,
    IconComponent,
    PageHeroComponent,
    PageFooterComponent,
    SettingsRowComponent,
    SpinnerComponent,
    TabsComponent,
  ],
  templateUrl: './admin.html',
})
export class AdminPageComponent {
  private readonly admin = inject(FederationAdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  private readonly dates = inject(DateFormatService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly layout = inject(LayoutService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly barSentinel = viewChild<ElementRef<HTMLElement>>('barSentinel');
  readonly stuck = signal(false);

  readonly row = '';
  readonly rows = SETTINGS_ROWS;
  readonly tile = SETTINGS_TILE;
  readonly value = 'text-text-muted text-[0.9375rem] font-semibold whitespace-nowrap tabular-nums';
  readonly status =
    'inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap before:size-2 before:rounded-full before:bg-current';
  readonly server = 'flex items-center gap-4 mb-2 ' + SETTINGS_TILE;
  readonly favicon =
    'font-display text-text grid size-11 shrink-0 place-items-center rounded-xl bg-[#242424] text-[1.0625rem] font-extrabold uppercase';
  readonly fieldIcon =
    'text-text-subtle pointer-events-none absolute top-1/2 left-4 -translate-y-1/2';
  readonly empty = 'grid justify-items-start gap-2.5 py-10';
  readonly emptyTitle = 'font-display text-text text-[1.75rem] font-extrabold tracking-[-0.04em]';
  readonly wall = createPosterWall();

  readonly state = signal<LoadState>('loading');
  readonly overview = signal<FederationOverview | null>(null);
  readonly reports = signal<FederationReport[]>([]);
  readonly busyDomain = signal<string | null>(null);

  readonly blockDomain = new FormControl('', { nonNullable: true });
  readonly blockReason = new FormControl('', { nonNullable: true });
  readonly allowDomain = new FormControl('', { nonNullable: true });

  readonly handleExample = computed(() => '@username@' + (this.overview()?.handleDomain ?? ''));
  readonly allowlistMode = computed(() => this.overview()?.mode === 'allowlist');

  readonly activeSection = signal<AdminSection>(
    this.resolveSection(this.route.snapshot.queryParamMap.get('section')) ?? 'federation',
  );
  readonly tabs = computed<TabItem[]>(() => {
    this.translate.lang();
    const overview = this.overview();
    const counts: Partial<Record<AdminSection, number>> = overview
      ? {
          instances: overview.instances.length,
          blocks: overview.blocks.length,
          allows: overview.allows.length,
          reports: this.reports().length,
        }
      : {};
    return SECTION_IDS.map((id) => ({
      id,
      label: this.translate.get('admin.' + id + '.title'),
      count: counts[id],
    }));
  });

  readonly sectionHint = computed(() => {
    const section = this.activeSection();
    if (section === 'allows') {
      return this.allowlistMode() ? 'admin.allows.hint_active' : 'admin.allows.hint_inactive';
    }
    return `admin.${section}.hint`;
  });

  constructor() {
    this.wall.load();
    this.layout.scrollTop.set(0);
    inject(DestroyRef).onDestroy(() => this.layout.scrollTop.set(0));
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.activeSection.set(this.resolveSection(params.get('section')) ?? 'federation');
    });
    this.load();
  }

  selectSection(id: string): void {
    const section = this.resolveSection(id);
    if (!section) return;
    this.activeSection.set(section);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onScroll(): void {
    const el = this.scrollContainer()?.nativeElement;
    this.layout.scrollTop.set(el?.scrollTop ?? 0);
    const sentinel = this.barSentinel()?.nativeElement;
    if (!el || !sentinel) return;
    const top = sentinel.getBoundingClientRect().top - el.getBoundingClientRect().top;
    const nav =
      window.innerWidth >= 768
        ? parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-height'),
          ) || 76
        : 0;
    this.stuck.set(top < nav - 0.5);
  }

  load(): void {
    forkJoin({ overview: this.admin.overview(), reports: this.admin.reports() }).subscribe({
      next: ({ overview, reports }) => {
        this.overview.set(overview);
        this.reports.set(reports);
        this.state.set('ready');
      },
      error: (error: unknown) =>
        this.state.set(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'error'),
    });
  }

  instanceSummary(instance: KnownInstance): string {
    const parts = [
      this.translate.get('admin.instances.accounts', { count: instance.accounts }),
      this.translate.get('admin.instances.followed', { count: instance.followedLocally }),
    ];
    if (instance.lastSeen) {
      parts.push(
        this.translate.get('admin.instances.seen', {
          when: this.dates.formatRelative(new Date(instance.lastSeen), this.translate.lang()),
        }),
      );
    }
    if (instance.isAllowed && !instance.isBlocked) {
      parts.push(this.translate.get('admin.instances.allowed'));
    }
    return parts.join(' · ');
  }

  instanceState(instance: KnownInstance): { label: string; tone: string } {
    if (instance.isBlocked) {
      return { label: this.translate.get('admin.instances.state_blocked'), tone: 'text-[#f0a5a5]' };
    }
    if (instance.failingDeliveries > 0) {
      return {
        label: this.translate.get('admin.instances.retrying', {
          count: instance.failingDeliveries,
        }),
        tone: 'text-[#e9c27a]',
      };
    }
    return { label: this.translate.get('admin.instances.state_ok'), tone: 'text-[#8fd9a8]' };
  }

  reportTitle(report: FederationReport): string {
    return this.translate.get('admin.reports.from', {
      reporter: report.reporterHandle ? '@' + report.reporterHandle : report.reporterDomain,
    });
  }

  reportMeta(report: FederationReport): string {
    const when = this.dates.formatRelative(new Date(report.createdAt), this.translate.lang());
    return report.targetHandle
      ? this.translate.get('admin.reports.about', { target: '@' + report.targetHandle, when })
      : when;
  }

  ruleDate(createdAt: string): string {
    return this.dates.formatDate(new Date(createdAt), this.translate.lang());
  }

  async block(domain: string, reason: string | null = null): Promise<void> {
    const target = domain.trim().toLowerCase();
    if (!target) return;
    const confirmed = await this.confirm.ask(
      this.translate.get('admin.blocks.confirm_message', { domain: target }),
      {
        title: this.translate.get('admin.blocks.confirm_title'),
        confirmLabel: this.translate.get('admin.blocks.block'),
        cancelLabel: this.translate.get('admin.cancel'),
        destructive: true,
      },
    );
    if (!confirmed) return;
    this.run(
      target,
      this.admin.block(target, reason?.trim() || null),
      'admin.blocks.blocked',
      () => {
        this.blockDomain.reset();
        this.blockReason.reset();
      },
    );
  }

  retryDeliveries(domain: string): void {
    this.run(
      domain,
      this.admin.retryDeliveries(domain).pipe(map(() => undefined)),
      'admin.instances.retried',
    );
  }

  unblock(domain: string): void {
    this.run(domain, this.admin.unblock(domain), 'admin.blocks.unblocked');
  }

  allow(domain: string): void {
    const target = domain.trim().toLowerCase();
    if (!target) return;
    this.run(target, this.admin.allow(target), 'admin.allows.allowed', () =>
      this.allowDomain.reset(),
    );
  }

  disallow(domain: string): void {
    this.run(domain, this.admin.disallow(domain), 'admin.allows.removed');
  }

  private run(
    domain: string,
    action: Observable<void>,
    successKey: string,
    done?: () => void,
  ): void {
    this.busyDomain.set(domain);
    action.subscribe({
      next: () => {
        this.busyDomain.set(null);
        this.toast.success(this.translate.get(successKey, { domain }));
        done?.();
        this.load();
      },
      error: (error: unknown) => {
        this.busyDomain.set(null);
        this.toast.error(this.errorMessage.fromError(error));
      },
    });
  }

  private resolveSection(id: string | null): AdminSection | null {
    return (SECTION_IDS as readonly string[]).includes(id ?? '') ? (id as AdminSection) : null;
  }
}
