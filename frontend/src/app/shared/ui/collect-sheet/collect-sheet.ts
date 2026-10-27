import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, switchMap, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CollectSheetService } from '@app/core/services/collect/collect-sheet';
import type { CollectTitle, EditableCreation } from '@app/core/services/collect/collect.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ListsService } from '@app/core/services/lists/lists';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { VersusService } from '@app/core/services/versus/versus';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { buttonClasses } from '@shared/ui/button/button';
import { DialogComponent } from '@shared/ui/dialog/dialog';
import { IconComponent } from '@shared/ui/icon/icon';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { TabsComponent, type TabItem } from '@shared/ui/tabs/tabs';

type Kind = 'lists' | 'versus';

type RowState = 'in' | 'busy' | 'out' | 'unavailable';

@Component({
  selector: 'shelfy-collect-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, IconComponent, SpinnerComponent, TabsComponent, TranslatePipe],
  templateUrl: './collect-sheet.html',
})
export class CollectSheetComponent {
  protected readonly sheet = inject(CollectSheetService);
  private readonly lists = inject(ListsService);
  private readonly versus = inject(VersusService);
  private readonly toast = inject(ToastService);
  private readonly errorMessage = inject(ErrorMessageService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  protected readonly primary = buttonClasses({ variant: 'primary' });
  protected readonly secondary = buttonClasses({ variant: 'secondary' });

  protected readonly titles = this.sheet.titles;
  protected readonly kind = signal<Kind>('lists');
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly creating = signal(false);
  private readonly targets = signal<Record<Kind, EditableCreation[]>>({ lists: [], versus: [] });
  private readonly added = signal<ReadonlySet<string>>(new Set());
  private readonly busy = signal<ReadonlySet<string>>(new Set());

  protected readonly single = computed(() => this.titles()?.length === 1);
  protected readonly subject = computed(() => {
    this.translate.lang();
    const titles = this.titles() ?? [];
    return titles.length === 1
      ? titles[0].title
      : this.translate.get('collect.many', { count: titles.length });
  });
  protected readonly rows = computed(() => this.targets()[this.kind()]);
  protected readonly tabs = computed<TabItem[]>(() => {
    this.translate.lang();
    return [
      { id: 'lists', label: this.translate.get('collect.lists') },
      { id: 'versus', label: this.translate.get('collect.versus') },
    ];
  });

  constructor() {
    effect(() => {
      const titles = this.titles();
      if (titles) untracked(() => this.load(titles));
    });
  }

  private load(titles: readonly CollectTitle[]): void {
    this.loading.set(true);
    this.failed.set(false);
    this.added.set(new Set());
    this.busy.set(new Set());
    const ref = titles.length === 1 ? reference(titles[0]) : undefined;
    forkJoin({ lists: this.lists.editable(ref), versus: this.versus.editable(ref) }).subscribe({
      next: (targets) => {
        this.targets.set(targets);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected stateOf(row: EditableCreation): RowState {
    if (this.busy().has(row.id)) return 'busy';
    if (row.containedId || this.added().has(row.id)) return 'in';
    if (this.kind() === 'versus' && row.hasClips) return 'unavailable';
    return 'out';
  }

  protected meta(row: EditableCreation): string {
    this.translate.lang();
    const parts = [
      this.translate.get(this.kind() === 'lists' ? 'lists.element' : 'collect.contenders', {
        count: row.itemCount,
      }),
    ];
    if (this.kind() === 'versus' && row.hasClips)
      parts.push(this.translate.get('collect.clips_only'));
    else if (row.visibility === 'private') parts.push(this.translate.get('lists.manage.draft'));
    if (!row.isOwner) parts.push(this.translate.get('collect.shared'));
    return parts.join(' · ');
  }

  protected toggle(row: EditableCreation): void {
    const titles = this.titles();
    if (!titles) return;
    const kind = this.kind();
    const state = this.stateOf(row);
    if (state === 'busy' || state === 'unavailable') return;
    if (state === 'in') {
      if (!this.single() || !row.containedId) return;
      this.run(row, this.removeFrom(kind, row.id, row.containedId), () =>
        this.patch(kind, row.id, { containedId: null, itemCount: row.itemCount - 1 }),
      );
      return;
    }
    const refs = titles.map(reference);
    this.run(row, this.addTo(kind, row.id, refs), (containedId) => {
      this.added.update((ids) => new Set(ids).add(row.id));
      this.patch(kind, row.id, {
        containedId: this.single() ? containedId : null,
        itemCount: row.itemCount + refs.length,
      });
      this.toast.success(this.translate.get('collect.added', { name: row.name }), 4000, {
        label: this.translate.get('collect.open'),
        run: () => this.openTarget(kind, row.id),
      });
    });
  }

  protected createNew(): void {
    const titles = this.titles();
    if (!titles || this.creating()) return;
    const kind = this.kind();
    const refs = titles.map(reference);
    this.creating.set(true);
    const done = (id: string) => {
      this.creating.set(false);
      this.sheet.close('navigated');
      void this.router.navigate([kind === 'lists' ? '/lists' : '/versus', id], {
        state: { fresh: true },
      });
    };
    const fail = (error: unknown) => {
      this.creating.set(false);
      this.toast.error(this.errorMessage.fromApiError(error));
    };
    if (kind === 'lists') {
      this.lists
        .create({
          name: this.translate.get('studio.untitled_list'),
          visibility: 'private',
          tags: [],
          media: refs,
        })
        .subscribe({ next: (list) => done(list.id), error: fail });
      return;
    }
    this.versus
      .createPool({ name: this.translate.get('studio.untitled_versus'), visibility: 'private' })
      .pipe(switchMap((pool) => this.versus.addItems(pool.id, refs).pipe(map(() => pool.id))))
      .subscribe({ next: done, error: fail });
  }

  private addTo(kind: Kind, id: string, refs: ReturnType<typeof reference>[]) {
    const titles = this.titles() ?? [];
    const key = titles.length === 1 ? keyOf(titles[0]) : null;
    if (kind === 'lists') {
      return this.lists
        .addItems(id, refs)
        .pipe(map((list) => (key ? (list.media.find((m) => keyOf(m) === key)?.id ?? null) : null)));
    }
    return this.versus
      .addItems(id, refs)
      .pipe(
        map((pool) =>
          key
            ? (pool.entries.find((e) => !e.clip && e.media && keyOf(e.media) === key)?.id ?? null)
            : null,
        ),
      );
  }

  private removeFrom(kind: Kind, id: string, containedId: string) {
    const request: Observable<unknown> =
      kind === 'lists'
        ? this.lists.removeItems(id, [containedId])
        : this.versus.removeItems(id, [containedId]);
    return request.pipe(map(() => null));
  }

  private run(
    row: EditableCreation,
    request: Observable<string | null>,
    onDone: (containedId: string | null) => void,
  ): void {
    this.busy.update((ids) => new Set(ids).add(row.id));
    const release = () =>
      this.busy.update((ids) => new Set([...ids].filter((busyId) => busyId !== row.id)));
    request.subscribe({
      next: (containedId) => {
        release();
        onDone(containedId);
      },
      error: (error: unknown) => {
        release();
        this.toast.error(this.errorMessage.fromApiError(error));
      },
    });
  }

  private patch(kind: Kind, id: string, change: Partial<EditableCreation>): void {
    this.targets.update((all) => ({
      ...all,
      [kind]: all[kind].map((row) => (row.id === id ? { ...row, ...change } : row)),
    }));
    if (change.containedId === null) {
      this.added.update((ids) => new Set([...ids].filter((addedId) => addedId !== id)));
    }
  }

  private openTarget(kind: Kind, id: string): void {
    this.sheet.close('navigated');
    void this.router.navigate([kind === 'lists' ? '/lists' : '/versus', id]);
  }
}

function reference({ provider, mediaType, externalId }: CollectTitle) {
  return { provider, mediaType, externalId };
}

function keyOf(item: { provider: string; mediaType: string; externalId: string }): string {
  return `${item.provider}:${item.mediaType}:${item.externalId}`;
}
