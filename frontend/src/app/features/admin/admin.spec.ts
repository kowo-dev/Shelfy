import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiError } from '@app/core/errors/api-error';
import { FederationAdminService } from '@app/core/services/admin/federation-admin';
import type { FederationOverview } from '@app/core/services/admin/federation-admin.model';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import { DiscoverService } from '@app/core/services/discover/discover';
import { TmdbService } from '@app/core/services/tmdb/tmdb';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';

import { AdminPageComponent } from './admin';

const OVERVIEW: FederationOverview = {
  isEnabled: true,
  mode: 'open',
  handleDomain: 'shelfy.dev',
  instances: [
    {
      domain: 'mastodon.example',
      accounts: 3,
      followedLocally: 2,
      lastSeen: '2026-10-19T10:00:00Z',
      pendingDeliveries: 1,
      failingDeliveries: 1,
      lastError: 'Got HTTP 503',
      isBlocked: false,
      isAllowed: false,
    },
  ],
  blocks: [{ domain: 'spam.example', reason: 'spam', createdAt: '2026-10-18T10:00:00Z' }],
  allows: [],
  reports: 1,
};

describe('AdminPageComponent', () => {
  let admin: Record<string, ReturnType<typeof vi.fn>>;
  let confirm: { ask: ReturnType<typeof vi.fn> };

  function create(overview = of(OVERVIEW), section: string | null = null) {
    const params = convertToParamMap(section ? { section } : {});
    admin = {
      overview: vi.fn().mockReturnValue(overview),
      reports: vi.fn().mockReturnValue(
        of([
          {
            id: 'r1',
            reporterDomain: 'mastodon.example',
            reporterHandle: 'mod@mastodon.example',
            targetHandle: 'kowo',
            objectUris: 'https://shelfy.dev/ap/users/1',
            content: 'Spam shelf',
            createdAt: '2026-10-19T10:00:00Z',
          },
        ]),
      ),
      retryDeliveries: vi.fn().mockReturnValue(of({ retried: 1 })),
      block: vi.fn().mockReturnValue(of(undefined)),
      unblock: vi.fn().mockReturnValue(of(undefined)),
      allow: vi.fn().mockReturnValue(of(undefined)),
      disallow: vi.fn().mockReturnValue(of(undefined)),
    };
    confirm = { ask: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: params }, queryParamMap: of(params) },
        },
        { provide: FederationAdminService, useValue: admin },
        { provide: ConfirmService, useValue: confirm },
        {
          provide: DiscoverService,
          useValue: {
            getMovies: vi.fn(() => of({ content: [{ posterPath: '/m.jpg' }] })),
            getSeries: vi.fn(() => of({ content: [{ posterPath: '/s.jpg' }] })),
          },
        },
        { provide: TmdbService, useValue: { imageUrl: (path: string) => path } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ErrorMessageService, useValue: { fromError: vi.fn(() => 'error') } },
        {
          provide: TranslateService,
          useValue: { get: vi.fn((key: string) => key), lang: vi.fn(() => 'en') },
        },
        {
          provide: DateFormatService,
          useValue: { formatRelative: vi.fn(() => 'today'), formatDate: vi.fn(() => 'Oct 18') },
        },
      ],
    });
    const fixture = TestBed.createComponent(AdminPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('opens on the federation section by default', () => {
    const fixture = create();
    const text = fixture.nativeElement.textContent as string;

    expect(fixture.componentInstance.activeSection()).toBe('federation');
    expect(text).toContain('admin.federation.status');
    expect(fixture.componentInstance.handleExample()).toBe('@username@shelfy.dev');
  });

  it('falls back to federation for an unknown section', () => {
    const fixture = create(of(OVERVIEW), 'nope');

    expect(fixture.componentInstance.activeSection()).toBe('federation');
  });

  it.each([
    ['instances', 'mastodon.example'],
    ['blocks', 'spam.example'],
    ['allows', 'admin.allows.empty'],
    ['reports', 'Spam shelf'],
  ])('reads the %s section from the query param and renders its panel', (section, expected) => {
    const fixture = create(of(OVERVIEW), section);
    const text = fixture.nativeElement.textContent as string;

    expect(fixture.componentInstance.activeSection()).toBe(section);
    expect(text).toContain('admin.' + section + '.title');
    expect(text).toContain(expected);
  });

  it('shows counts on the tabs once loaded', () => {
    const fixture = create();

    expect(fixture.componentInstance.tabs().map((tab) => [tab.id, tab.count])).toEqual([
      ['federation', undefined],
      ['instances', 1],
      ['blocks', 1],
      ['allows', 0],
      ['reports', 1],
    ]);
  });

  it('switches section and writes it to the url', () => {
    const fixture = create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.selectSection('blocks');
    fixture.detectChanges();

    expect(fixture.componentInstance.activeSection()).toBe('blocks');
    expect(fixture.nativeElement.textContent).toContain('spam.example');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { section: 'blocks' }, replaceUrl: true }),
    );

    fixture.componentInstance.selectSection('bogus');
    expect(fixture.componentInstance.activeSection()).toBe('blocks');
  });

  it('asks before blocking an instance, then reloads', async () => {
    const fixture = create();

    await fixture.componentInstance.block(' Mastodon.Example ', 'spam');

    expect(confirm.ask).toHaveBeenCalled();
    expect(admin['block']).toHaveBeenCalledWith('mastodon.example', 'spam');
    expect(admin['overview']).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the block is not confirmed', async () => {
    const fixture = create();
    confirm.ask.mockResolvedValue(false);

    await fixture.componentInstance.block('mastodon.example');

    expect(admin['block']).not.toHaveBeenCalled();
  });

  it('retries the failing deliveries of an instance, then reloads', () => {
    const fixture = create();

    fixture.componentInstance.retryDeliveries('mastodon.example');

    expect(admin['retryDeliveries']).toHaveBeenCalledWith('mastodon.example');
    expect(admin['overview']).toHaveBeenCalledTimes(2);
  });

  it('shows the admins only state on 403', () => {
    const fixture = create(throwError(() => new ApiError(403, 'Forbidden', 'UNAUTHORIZED')));

    expect(fixture.componentInstance.state()).toBe('forbidden');
  });

  it('heads the page like the others: poster wall, back to settings and instance facts', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.wall.posters()).toEqual(['/m.jpg', '/s.jpg']);
    const facts = el.querySelector('shelfy-page-hero p')?.textContent ?? '';
    expect(facts).toContain('admin.stat.federation_on');
    expect(facts).toContain('admin.stat.instances');
  });

  it('lists every section in the tab bar and marks the current one', () => {
    const fixture = create(of(OVERVIEW), 'reports');
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'shelfy-tabs button',
      ),
    );

    expect(rows).toHaveLength(5);
    expect(rows[4].getAttribute('aria-selected')).toBe('true');
    rows[1].click();
    expect(fixture.componentInstance.activeSection()).toBe('instances');
  });

  it('shows the delivery or block state next to the instance and offers to unblock', () => {
    const blocked = {
      ...OVERVIEW,
      instances: [{ ...OVERVIEW.instances[0], isBlocked: true, failingDeliveries: 0 }],
    };
    const fixture = create(of(blocked), 'instances');
    const component = fixture.componentInstance;

    expect(component.instanceState(OVERVIEW.instances[0]).label).toBe('admin.instances.retrying');
    expect(component.instanceState(blocked.instances[0]).label).toBe(
      'admin.instances.state_blocked',
    );
    const unblock = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('admin.blocks.unblock'));
    unblock?.click();
    expect(admin['unblock']).toHaveBeenCalledWith('mastodon.example');
  });

  it('explains the allowlist differently when the mode is active', () => {
    const fixture = create(of(OVERVIEW), 'allows');
    expect(fixture.componentInstance.sectionHint()).toBe('admin.allows.hint_inactive');

    TestBed.resetTestingModule();
    const allowlist = create(of({ ...OVERVIEW, mode: 'allowlist' as const }), 'allows');
    expect(allowlist.componentInstance.sectionHint()).toBe('admin.allows.hint_active');
  });
});
