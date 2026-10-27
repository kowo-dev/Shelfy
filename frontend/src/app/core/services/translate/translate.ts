import { firstValueFrom } from 'rxjs';

import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';

type Translations = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class TranslateService {
  private readonly http = inject(HttpClient);
  private readonly _translations = signal<Translations>({});
  readonly lang = signal<string>('en');

  async init(): Promise<void> {
    await this.load('en');
  }

  get(key: string, params?: Record<string, string | number>): string {
    const t = this._translations();
    let result: string;

    if (params?.['count'] !== undefined) {
      const variant = params['count'] === 1 ? `${key}_one` : `${key}_other`;
      result = this.resolve(t, variant) || this.resolve(t, key) || key;
    } else {
      result = this.resolve(t, key) || key;
    }

    if (params) {
      result = result.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? 0));
    }

    return result;
  }

  private async load(lang: string): Promise<void> {
    const data = await firstValueFrom(this.http.get<Translations>(`/i18n/${lang}.json`));
    this.lang.set(lang);
    this._translations.set(data);
  }

  private resolve(translations: Translations, key: string): string {
    const parts = key.split('.');
    let current: unknown = translations;
    for (const part of parts) {
      if (typeof current !== 'object' || current === null) return '';
      current = (current as Record<string, unknown>)[part];
    }
    return typeof current === 'string' ? current : '';
  }
}
