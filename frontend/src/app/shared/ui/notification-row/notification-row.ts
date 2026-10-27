import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DateFormatService } from '@app/core/services/date-format/date-format';
import type { NotificationResponse } from '@app/core/services/notifications/notifications.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@shared/pipes/translate';
import { AvatarComponent } from '@shared/ui/avatar/avatar';
import { buttonClasses } from '@shared/ui/button/button';
import { IconComponent } from '@shared/ui/icon/icon';
import { SpinnerComponent } from '@shared/ui/spinner/spinner';
import { actorName, FAMILY_ICONS, notificationCopy, REQUEST_TYPES } from './notification-copy';

@Component({
  selector: 'shelfy-notification-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, AvatarComponent, IconComponent, SpinnerComponent],
  host: { class: 'block mt-2 first-of-type:mt-0' },
  template: `
    @let item = notification();
    @let text = copy();
    <div
      class="group/row duration-slow relative flex items-center gap-4 rounded-[18px] bg-white/6 px-5 py-4.5 transition-colors has-[a.row-link:hover]:bg-white/9"
    >
      @if (text.link) {
        <a
          class="row-link absolute inset-0 rounded-[18px] outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(230_211_179/0.5)]"
          [routerLink]="text.link"
          [queryParams]="text.query"
          [attr.aria-label]="label()"
          (click)="opened.emit()"
        ></a>
      }

      <span class="pointer-events-none relative size-11 shrink-0">
        @if (item.actors.length > 1) {
          <shelfy-avatar
            class="bg-surface-3 absolute top-0 left-0 rounded-full"
            [displayName]="name(item.actors[1])"
            [avatarUrl]="item.actors[1].avatarUrl"
            size="28"
          />
          <shelfy-avatar
            class="bg-surface-3 ring-background absolute right-0 bottom-0 rounded-full ring-2"
            [displayName]="name(item.actors[0])"
            [avatarUrl]="item.actors[0].avatarUrl"
            size="28"
          />
        } @else if (item.actor) {
          <shelfy-avatar
            class="bg-surface-3 rounded-full"
            [displayName]="name(item.actor)"
            [avatarUrl]="item.actor.avatarUrl"
            size="md"
          />
        } @else {
          <span
            class="text-text-muted grid size-full place-items-center rounded-[0.875rem] bg-white/8"
          >
            <shelfy-icon [name]="familyIcon()" size="22" />
          </span>
        }
        @if (item.actors.length === 1) {
          <span
            class="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-[#2e2e2e] shadow-[0_2px_8px_rgb(0_0_0/0.45)]"
            [class]="item.family === 'LIKES' ? 'text-[#ff8f8f]' : 'text-text'"
          >
            <shelfy-icon [name]="familyIcon()" size="13" />
          </span>
        }
      </span>

      <span class="pointer-events-none min-w-0 flex-1">
        <span
          class="block text-base leading-[1.45]"
          [class]="item.isRead ? 'text-text-muted' : 'text-[#e8e8e8]'"
        >
          @if (text.lead) {
            <span class="text-text font-semibold">{{ text.lead }}</span>
          }
          {{ rest() }}
          @if (text.domain) {
            <span class="text-text-subtle font-semibold">&#64;{{ text.domain }}</span>
          }
        </span>
        @if (text.excerpt) {
          <span class="text-text-subtle mt-1 line-clamp-2 block text-[0.9375rem] leading-snug"
            >“{{ text.excerpt }}”</span
          >
        }
        <span class="text-text-subtle mt-0.5 flex items-center gap-2 text-[0.8125rem] tabular-nums">
          @if (!item.isRead) {
            <span class="bg-accent size-1.75 shrink-0 rounded-full" aria-hidden="true"></span>
          }
          {{ when() }}
        </span>
      </span>

      @if (cover(); as src) {
        <img
          class="pointer-events-none aspect-2/3 w-10 shrink-0 rounded-lg object-cover"
          [src]="src"
          alt=""
          loading="lazy"
        />
      }
      @if (pending()) {
        <span class="relative flex shrink-0 gap-2">
          <button
            type="button"
            [class]="acceptButton"
            [disabled]="busy()"
            [attr.aria-busy]="busy()"
            (click)="answered.emit(true)"
          >
            @if (busy()) {
              <shelfy-spinner size="sm" />
            }
            {{ 'notifications.accept' | translate }}
          </button>
          <button
            type="button"
            [class]="declineButton"
            [disabled]="busy()"
            (click)="answered.emit(false)"
          >
            {{ 'notifications.decline' | translate }}
          </button>
        </span>
      } @else if (clearable()) {
        <button
          type="button"
          class="text-text-muted hover:text-text touch:opacity-100 relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-full opacity-0 transition-[opacity,background-color,color] duration-300 group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-white/10 focus-visible:opacity-100"
          [attr.aria-label]="('notifications.clear' | translate) + ' · ' + sentence()"
          [title]="'notifications.clear' | translate"
          (click)="cleared.emit()"
        >
          <shelfy-icon name="close" size="18" />
        </button>
      }
    </div>
  `,
})
export class NotificationRowComponent {
  private readonly translate = inject(TranslateService);
  private readonly dates = inject(DateFormatService);

  readonly notification = input.required<NotificationResponse>();
  readonly busy = input(false);
  readonly clearable = input(false);
  readonly answered = output<boolean>();
  readonly cleared = output<void>();
  readonly opened = output<void>();

  readonly copy = computed(() => notificationCopy(this.notification()));
  readonly familyIcon = computed(() => FAMILY_ICONS[this.notification().family] ?? 'bell');
  readonly pending = computed(
    () => REQUEST_TYPES.has(this.notification().type) && !this.notification().isResolved,
  );
  readonly cover = computed(() => {
    const value = this.notification().payload['cover'];
    return typeof value === 'string' && value ? value : null;
  });

  readonly rest = computed(() => {
    this.translate.lang();
    const { key, params, others } = this.copy();
    const sentence = this.translate.get(key, params);
    if (others === 0) return sentence;
    const folded = this.translate.get(
      others === 1 ? 'notifications.others_one' : 'notifications.others_many',
      { count: others },
    );
    return `${folded} ${sentence}`;
  });

  readonly sentence = computed(() => [this.copy().lead, this.rest()].filter(Boolean).join(' '));

  readonly label = computed(() =>
    this.notification().isRead
      ? this.sentence()
      : `${this.translate.get('notifications.unread_label')}, ${this.sentence()}`,
  );

  protected readonly acceptButton = buttonClasses({ variant: 'primary', size: 'sm' });
  protected readonly declineButton = buttonClasses({ variant: 'secondary', size: 'sm' });

  readonly when = computed(() =>
    this.dates.formatElapsed(new Date(this.notification().updatedAt), this.translate.lang()),
  );

  protected name = actorName;
}
