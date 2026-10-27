import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FollowUserResponse } from '@app/core/services/follows/follows';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { IconComponent } from '@shared/ui/icon/icon';
import { PersonRowComponent } from '@shared/ui/person-row/person-row';
import { SearchbarComponent } from '@shared/ui/searchbar/searchbar';
import { SideSheetComponent } from '@shared/ui/side-sheet/side-sheet';
import { HIT_AREA_40 } from '@shared/ui/ui-recipes';
import { buttonClasses } from '@shared/ui/button/button';

export interface CollaboratorMember {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

@Component({
  selector: 'shelfy-collaborators-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    IconComponent,
    SearchbarComponent,
    PersonRowComponent,
    SideSheetComponent,
  ],
  template: `
    <shelfy-side-sheet
      size="md"
      [title]="'lists.collab.title' | translate"
      (closed)="closed.emit()"
    >
      <section class="bg-surface-raised rounded-2xl p-4 sm:p-5">
        <ul class="flex flex-col gap-1">
          @if (owner(); as author) {
            <li>
              <shelfy-person-row
                [displayName]="author.username"
                [avatarUrl]="author.avatarUrl"
                [subline]="'lists.collab.author' | translate"
                [route]="['/profile', author.username]"
              />
            </li>
          }
          @for (member of members(); track member.userId) {
            <li animate.enter="animate-rise-in" animate.leave="animate-fade-out">
              <shelfy-person-row
                [displayName]="member.displayName || member.username"
                [avatarUrl]="member.avatarUrl"
                [subline]="'@' + member.username"
                [route]="['/profile', member.username]"
              >
                @if (isOwner()) {
                  <button
                    personRowActions
                    type="button"
                    [class]="iconAction"
                    [attr.aria-label]="
                      ('lists.collab.remove' | translate) +
                      ' · ' +
                      (member.displayName || member.username)
                    "
                    [disabled]="busyUserId() === member.userId"
                    (click)="removed.emit(member.userId)"
                  >
                    <shelfy-icon name="close" size="sm" />
                  </button>
                }
              </shelfy-person-row>
            </li>
          }
        </ul>
        @if (members().length === 0 && pending().length === 0) {
          <p class="text-text-subtle mt-4 text-sm">{{ 'lists.collab.empty' | translate }}</p>
        }
      </section>

      @if (isOwner() && pending().length > 0) {
        <section class="bg-surface-raised rounded-2xl p-4 sm:p-5">
          <h3 class="font-display text-text mb-4 text-lg font-bold">
            {{ 'lists.collab.pending_title' | translate }}
          </h3>
          <ul class="flex flex-col gap-1">
            @for (invite of pending(); track invite.userId) {
              <li animate.enter="animate-rise-in" animate.leave="animate-fade-out">
                <shelfy-person-row
                  [displayName]="invite.displayName || invite.username"
                  [avatarUrl]="invite.avatarUrl"
                  [subline]="'lists.collab.pending_badge' | translate"
                >
                  <button
                    personRowActions
                    type="button"
                    [class]="iconAction"
                    [attr.aria-label]="
                      ('lists.collab.cancel_invite' | translate) +
                      ' · ' +
                      (invite.displayName || invite.username)
                    "
                    [disabled]="busyUserId() === invite.userId"
                    (click)="inviteCancelled.emit(invite.userId)"
                  >
                    <shelfy-icon name="close" size="sm" />
                  </button>
                </shelfy-person-row>
              </li>
            }
          </ul>
        </section>
      }

      @if (isOwner()) {
        <section class="bg-surface-raised rounded-2xl p-4 sm:p-5">
          <h3 class="font-display text-text text-lg font-bold">
            {{ 'lists.collab.invite_panel_title' | translate }}
          </h3>
          <shelfy-searchbar
            class="mt-4 block"
            variant="pill"
            [placeholder]="'lists.collab.search_followers' | translate"
            [ngModel]="query()"
            (ngModelChange)="query.set($event); queryChange.emit($event)"
          />
          @if (candidates().length === 0) {
            <p class="text-text-subtle mt-3 text-sm">
              {{ 'lists.collab.no_followers_available' | translate }}
            </p>
          } @else {
            <ul class="mt-2 flex flex-col gap-1">
              @for (person of candidates(); track person.id) {
                <li animate.enter="animate-rise-in" animate.leave="animate-fade-out">
                  <shelfy-person-row
                    [displayName]="person.displayName || person.username"
                    [avatarUrl]="person.avatarUrl"
                    [subline]="'@' + person.username"
                  >
                    <button
                      personRowActions
                      type="button"
                      [class]="pill"
                      [disabled]="busyUserId() === person.id"
                      [attr.aria-label]="
                        ('lists.collab.invite' | translate) +
                        ' · ' +
                        (person.displayName || person.username)
                      "
                      (click)="invited.emit(person)"
                    >
                      {{ 'lists.collab.invite' | translate }}
                    </button>
                  </shelfy-person-row>
                </li>
              }
            </ul>
          }
        </section>
      }
    </shelfy-side-sheet>
  `,
})
export class CollaboratorsSheetComponent {
  isOwner = input(false);
  owner = input<{ username: string; avatarUrl: string | null } | null>(null);
  members = input<readonly CollaboratorMember[]>([]);
  pending = input<readonly CollaboratorMember[]>([]);
  candidates = input<readonly FollowUserResponse[]>([]);
  busyUserId = input<string | null>(null);

  closed = output<void>();
  removed = output<string>();
  inviteCancelled = output<string>();
  invited = output<FollowUserResponse>();
  queryChange = output<string>();

  protected readonly pill = buttonClasses({ variant: 'secondary' });
  protected readonly iconAction = `${HIT_AREA_40} text-text-subtle hover:text-text grid size-8 cursor-pointer place-items-center rounded-full transition-colors hover:bg-fill disabled:cursor-not-allowed disabled:opacity-50`;
  protected readonly query = signal('');
}
