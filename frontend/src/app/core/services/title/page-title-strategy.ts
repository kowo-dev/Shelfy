import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { PageCacheStrategy } from '@app/core/services/page-cache/page-cache-strategy';
import { TranslateService } from '@app/core/services/translate/translate';
import { PageMetaService } from './page-meta';

const SEGMENT_TITLE_KEYS: Record<string, string> = {
  discover: 'nav.discover',
  explore: 'nav.explore',
  creations: 'nav.creations',
  people: 'nav.people',
  notifications: 'nav.notifications',
  collection: 'nav.collection',
  lists: 'nav.lists',
  versus: 'nav.versus',
  reviews: 'nav.reviews',
  profile: 'nav.profile',
  settings: 'nav.settings',
  admin: 'admin.title',
  users: 'nav.profile',
};

const PATH_TITLE_KEYS: [RegExp, string][] = [
  [/^\/lists\/new$/, 'lists.new'],
  [/^\/lists\/[^/]+\/edit$/, 'lists.edit'],
  [/^\/versus\/new$/, 'versus.form.title'],
  [/^\/reviews\/[^/]+$/, 'nav.reviews'],
  [/^\/legal\/privacy-policy$/, 'legal.privacy.title'],
  [/^\/legal\/terms$/, 'legal.terms.title'],
  [/^\/legal\/notice$/, 'legal.notice.title'],
  [/^\/auth\/login$/, 'auth.sign_in'],
  [/^\/auth\/register$/, 'auth.create_account'],
  [/^\/auth\/forgot-password$/, 'auth.forgot_password'],
  [/^\/auth\/reset-password$/, 'auth.reset_password'],
  [/^\/auth\/verify-email$/, 'auth.verify_email'],
  [/^\/confirm-email-change$/, 'auth.confirm_email_change'],
];

const APP_NAME = 'Shelfy';

@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);
  private readonly pageMeta = inject(PageMetaService);
  private readonly pageCache = inject(PageCacheStrategy);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const restored = this.pageCache.takeRestoredTitle();
    if (restored) {
      this.apply(restored);
      return;
    }
    const explicit = this.buildTitle(snapshot);
    if (explicit) {
      this.apply(`${explicit} · ${APP_NAME}`);
      return;
    }
    const path = snapshot.url.split('?')[0].split('#')[0];
    const segment = path.split('/').filter(Boolean)[0];
    const key =
      PATH_TITLE_KEYS.find(([pattern]) => pattern.test(path))?.[1] ??
      (segment ? SEGMENT_TITLE_KEYS[segment] : undefined);
    this.apply(key ? `${this.translate.get(key)} · ${APP_NAME}` : APP_NAME);
  }

  private apply(title: string): void {
    this.title.setTitle(title);
    this.pageMeta.reset(title);
  }
}
