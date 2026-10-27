import { inject, Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { CollectionService } from '@app/core/services/collection/collection';
import type {
  CollectionItemResponse,
  MediaType,
} from '@app/core/services/collection/collection.model';
import { ErrorMessageService } from '@app/core/services/error-message/error-message';
import { ToastService } from '@app/core/services/toast/toast';
import { TranslateService } from '@app/core/services/translate/translate';
import { catchAndToastError } from '@shared/utils/catch-and-toast-error.util';

export interface AddTarget {
  provider: string;
  mediaType: MediaType;
  externalId: string;
  title: string;
  coverUrl: string | null;
  subtitle: string | null;
}

@Injectable({ providedIn: 'root' })
export class AddSheetService {
  private readonly collection = inject(CollectionService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly errorMessage = inject(ErrorMessageService);

  readonly added = new Subject<CollectionItemResponse>();

  open(target: AddTarget): void {
    this.collection
      .create({
        provider: target.provider,
        mediaType: target.mediaType,
        externalId: target.externalId,
        status: 'planned',
      })
      .subscribe({
        next: (item) => {
          this.toast.success(this.translate.get('collection.backlog.added'), undefined, undefined, {
            title: target.title,
            coverUrl: target.coverUrl,
          });
          this.added.next(item);
        },
        error: catchAndToastError(this.toast, this.errorMessage),
      });
  }
}
