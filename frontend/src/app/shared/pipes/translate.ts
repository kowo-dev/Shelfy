import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@app/core/services/translate/translate';

@Pipe({ name: 'translate', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(key: string, params?: Record<string, string | number>): string {
    this.translate.lang();
    return this.translate.get(key, params);
  }
}
