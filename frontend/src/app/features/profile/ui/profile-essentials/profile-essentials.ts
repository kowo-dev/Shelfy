import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdultGateService } from '@app/core/services/adult-gate/adult-gate';
import { EssentialsService } from '@app/core/services/essentials/essentials';
import {
  ESSENTIALS_SLOTS,
  type EssentialEntry,
} from '@app/core/services/essentials/essentials.model';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { TranslatePipe } from '@app/shared/pipes/translate';
import { AdultBadgeComponent } from '@shared/ui/adult-badge/adult-badge';
import { IconComponent } from '@shared/ui/icon/icon';
import { imageRendition } from '@shared/utils/image-rendition.util';
import { EssentialsPickerComponent } from '../essentials-picker/essentials-picker';

interface EssentialsSlot {
  index: number;
  entry: EssentialEntry | null;
}

@Component({
  selector: 'shelfy-profile-essentials',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdultBadgeComponent,
    IconComponent,
    EssentialsPickerComponent,
    RouterLink,
    TranslatePipe,
  ],
  host: { class: 'block min-w-0' },
  template: `
    @if (slots().length > 0) {
      <section class="v-sec v-band v-ess-band" aria-labelledby="essentials-title">
        <div class="v-essf-h">
          <div>
            <h2 id="essentials-title">{{ 'profile.essentials.title' | translate }}</h2>
            <p>
              {{
                owner()
                  ? ('profile.essentials.owner_hint' | translate)
                  : ('profile.essentials.hint' | translate: { name: name() })
              }}
            </p>
          </div>
          @if (owner() && entries().length > 0) {
            <button type="button" class="v-essf-edit" (click)="picking.set(true)">
              <shelfy-icon name="edit" size="18" />{{ 'profile.essentials.edit' | translate }}
            </button>
          }
        </div>
        <div class="v-essf-row">
          @for (slot of slots(); track slot.index) {
            @if (slot.entry; as entry) {
              @if (hidden(entry)) {
                <button
                  type="button"
                  class="v-essf-it"
                  [attr.aria-label]="'adult.hidden' | translate"
                  (click)="openAdultGate()"
                >
                  <span class="v-art grid place-items-center">
                    <shelfy-adult-badge size="2rem" />
                  </span>
                </button>
              } @else {
                <a
                  class="v-essf-it"
                  [routerLink]="['/media', entry.media.mediaType, entry.media.externalId]"
                >
                  <span class="v-art">
                    @if (cover(entry); as url) {
                      <img [src]="url" alt="" draggable="false" loading="lazy" />
                    }
                  </span>
                  <b>{{ entry.media.title }}</b>
                  <span>{{ meta(entry) }}</span>
                </a>
              }
            } @else {
              <button
                type="button"
                class="v-essf-it"
                [attr.aria-label]="'profile.essentials.add' | translate"
                (click)="picking.set(true)"
              >
                <span class="v-art v-essf-empty">
                  <shelfy-icon name="plus" size="lg" />
                </span>
              </button>
            }
          }
        </div>
      </section>
    }

    @if (picking()) {
      <shelfy-essentials-picker
        [entries]="entries()"
        [saving]="saving()"
        (saved)="save($event)"
        (closed)="picking.set(false)"
      />
    }
  `,
})
export class ProfileEssentialsComponent {
  private readonly essentials = inject(EssentialsService);
  private readonly adultGate = inject(AdultGateService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly entries = input.required<EssentialEntry[]>();
  readonly owner = input(false);
  readonly name = input('');
  readonly entriesChange = output<EssentialEntry[]>();

  protected readonly picking = signal(false);
  protected readonly saving = signal(false);
  protected readonly slots = computed<EssentialsSlot[]>(() => {
    const entries = this.entries();
    const count = this.owner() ? ESSENTIALS_SLOTS : entries.length;
    return Array.from({ length: count }, (_, index) => ({
      index,
      entry: entries[index] ?? null,
    }));
  });

  protected meta(entry: EssentialEntry): string {
    const date = entry.media.metadata?.['releaseDate'];
    const year = typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : null;
    const type = this.translate.get('collection.media_type_one.' + entry.media.mediaType);
    return year ? `${type} · ${year}` : type;
  }

  protected hidden(entry: EssentialEntry): boolean {
    return !!entry.media.isAdult && !entry.media.externalId;
  }

  protected cover(entry: EssentialEntry): string | null {
    const url = this.hidden(entry) ? null : entry.media.coverUrl;
    return url ? imageRendition(url, 'card') : null;
  }

  protected openAdultGate(): void {
    void this.adultGate.open();
  }

  protected save(ids: string[]): void {
    this.saving.set(true);
    this.essentials.replace(ids).subscribe({
      next: (entries) => {
        this.saving.set(false);
        this.picking.set(false);
        this.entriesChange.emit(entries);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error(this.translate.get('profile.essentials.save_error'));
      },
    });
  }
}
