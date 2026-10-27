import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { Toast, ToastService } from '@app/core/services/toast/toast';
import { IconComponent } from '@shared/ui/icon/icon';
import { TranslatePipe } from '@app/shared/pipes/translate';

const EXIT_ANIMATION_MS = 240;

const STATUS_ICONS: Record<string, { name: string; color: string }> = {
  success: { name: 'checkCircle', color: 'text-status-done' },
  error: { name: 'errorCircle', color: 'text-danger-fg' },
  warning: { name: 'warningTriangle', color: 'text-warning' },
  info: { name: 'info', color: 'text-text-muted' },
};

interface DisplayToast extends Toast {
  closing: boolean;
}

@Component({
  selector: 'shelfy-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  template: `
    <div
      aria-live="polite"
      aria-atomic="false"
      class="pointer-events-none fixed inset-x-0 bottom-6 z-[200] flex flex-col items-center gap-2 px-4 max-md:bottom-[calc(108px+env(safe-area-inset-bottom))]"
    >
      @for (toast of displayToasts(); track toast.id) {
        <div
          role="status"
          class="text-text pointer-events-auto flex min-h-14 w-full max-w-md items-center gap-3 rounded-[1.125rem] bg-[rgb(30_30_30/0.95)] p-2 shadow-[0_24px_50px_-18px_#000,inset_0_0_0_1px_rgb(255_255_255/0.06)] backdrop-blur-xl md:w-auto md:min-w-80"
          [class.animate-toast-in]="!toast.closing"
          [class.animate-toast-out]="toast.closing"
          [class.absolute]="toast.closing"
        >
          @if (toast.media; as media) {
            <span class="bg-surface-3 h-12.5 w-8.5 shrink-0 overflow-hidden rounded-[7px]">
              @if (media.coverUrl) {
                <img [src]="media.coverUrl" alt="" class="size-full object-cover" />
              }
            </span>
          } @else {
            <shelfy-icon
              [name]="statusIcon(toast).name"
              [class]="statusIcon(toast).color"
              size="22"
              [active]="true"
              class="ml-2 shrink-0"
            />
          }
          <span class="min-w-0 flex-1 pr-1.5 text-[0.9375rem] leading-tight font-semibold">
            <span class="line-clamp-2">{{ toast.message }}</span>
            @if (toast.media; as media) {
              <small class="text-text-muted mt-0.5 block truncate text-[0.8125rem] font-medium">{{
                media.title
              }}</small>
            }
          </span>
          @if (toast.action; as action) {
            <button type="button" [class]="actionClasses" (click)="toastService.act(toast.id)">
              {{ action.label }}
            </button>
          } @else {
            <button
              type="button"
              [class]="closeClasses"
              [attr.aria-label]="'shared.dismiss' | translate"
              (click)="dismiss(toast.id)"
            >
              <shelfy-icon name="close" size="sm" />
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent implements OnDestroy {
  readonly toastService = inject(ToastService);
  readonly displayToasts = signal<DisplayToast[]>([]);
  readonly actionClasses =
    'text-text h-10 shrink-0 cursor-pointer rounded-xl bg-white/10 px-3.5 text-[0.8125rem] font-bold transition-colors hover:bg-white/16';
  readonly closeClasses =
    'text-text-subtle hover:text-text grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl transition-colors hover:bg-white/8';

  private readonly exitTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    effect(() => {
      const current = this.toastService.toasts();
      const currentIds = new Set(current.map((t) => t.id));

      this.displayToasts.update((list) => {
        const existingIds = new Set(list.map((t) => t.id));
        const added: DisplayToast[] = current
          .filter((t) => !existingIds.has(t.id))
          .map((t) => ({ ...t, closing: false }));
        const kept = list.map((t) =>
          !currentIds.has(t.id) && !t.closing ? { ...t, closing: true } : t,
        );
        return [...kept, ...added];
      });

      for (const toast of this.displayToasts()) {
        if (toast.closing && !this.exitTimers.has(toast.id)) {
          const timer = setTimeout(() => {
            this.displayToasts.update((list) => list.filter((t) => t.id !== toast.id));
            this.exitTimers.delete(toast.id);
          }, EXIT_ANIMATION_MS);
          this.exitTimers.set(toast.id, timer);
        }
      }
    });
  }

  ngOnDestroy(): void {
    for (const timer of this.exitTimers.values()) {
      clearTimeout(timer);
    }
  }

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }

  statusIcon(toast: Toast): { name: string; color: string } {
    return STATUS_ICONS[toast.type] ?? STATUS_ICONS['info'];
  }
}
