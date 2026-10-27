import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { TranslateService } from '@app/core/services/translate/translate';
import { renderRichTextHtml } from '@shared/utils/rich-text-html.util';
import { richTextDocument, type RichTextContent } from '@shared/utils/rich-text.util';

@Component({
  selector: 'shelfy-rich-text-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<div class="shelfy-rich-text-content" [innerHTML]="html()" (click)="activate($event)" (keydown.enter)="activate($event)" (keydown.space)="revealSpoiler($event)" tabindex="-1" role="presentation"></div>',
  host: { class: 'shelfy-rich-text-view block' },
})
export class RichTextViewComponent {
  private readonly confirm = inject(ConfirmService);
  private readonly translate = inject(TranslateService);
  content = input<RichTextContent | null>(null);
  readonly html = computed(() => {
    const spoiler = {
      role: 'button',
      tabindex: '0',
      'aria-label': this.translate.get('rich_text.spoiler_reveal'),
    };
    try {
      return renderRichTextHtml(richTextDocument(this.content()), { spoiler });
    } catch {
      return '';
    }
  });

  async activate(event: Event): Promise<void> {
    if (this.revealSpoiler(event)) return;
    await this.openLink(event);
  }

  revealSpoiler(event: Event): boolean {
    const spoiler = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      '.shelfy-spoiler:not(.is-revealed)',
    );
    if (!spoiler) return false;
    event.preventDefault();
    event.stopPropagation();
    spoiler.classList.add('is-revealed');
    spoiler.removeAttribute('role');
    spoiler.removeAttribute('aria-label');
    spoiler.tabIndex = -1;
    spoiler.focus();
    return true;
  }

  async openLink(event: Event): Promise<void> {
    const link = (event.target as HTMLElement | null)?.closest(
      'a[href]',
    ) as HTMLAnchorElement | null;
    if (!link) return;
    event.preventDefault();
    const host = new URL(link.href).hostname;
    const href = link.href;
    const leave = await this.confirm.ask(this.translate.get('dialog.external_link', { host }), {
      title: this.translate.get('dialog.external_link_title'),
      confirmLabel: this.translate.get('dialog.open_link'),
      url: href,
      delaySeconds: 5,
    });
    if (leave) window.open(href, '_blank', 'noopener,noreferrer');
  }
}
