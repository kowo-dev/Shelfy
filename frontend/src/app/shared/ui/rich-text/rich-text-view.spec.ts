import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ConfirmService } from '@app/core/services/confirm/confirm';
import { TranslateService } from '@app/core/services/translate/translate';

import { RichTextViewComponent } from './rich-text-view';

describe('RichTextViewComponent security', () => {
  const ask = vi.fn();

  function render(content: Record<string, unknown>): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfirmService, useValue: { ask } },
        { provide: TranslateService, useValue: { get: (k: string) => k, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(RichTextViewComponent);
    fixture.componentRef.setInput('content', content);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const doc = (text: string, marks?: unknown[]) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text, marks }] }],
  });

  it('escapes markup typed as text instead of rendering it', () => {
    const el = render(doc('<img src=x onerror=alert(1)><script>alert(1)</script>'));

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<script>alert(1)</script>');
  });

  it('never renders a javascript: link', () => {
    const el = render(doc('click', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]));

    for (const link of Array.from(el.querySelectorAll('a'))) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i);
    }
  });

  it('hardens external links', () => {
    const el = render(doc('site', [{ type: 'link', attrs: { href: 'https://example.com/' } }]));
    const link = el.querySelector('a');

    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.getAttribute('rel')).toContain('noreferrer');
  });

  it('asks for confirmation and does not navigate when the user declines', async () => {
    ask.mockResolvedValue(false);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const el = render(doc('site', [{ type: 'link', attrs: { href: 'https://example.com/' } }]));

    el.querySelector('a')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(ask).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('hides spoilers behind a labelled button until revealed', () => {
    const el = render(doc('the butler', [{ type: 'spoiler' }]));
    const spoiler = el.querySelector<HTMLElement>('.shelfy-spoiler');

    expect(spoiler?.getAttribute('role')).toBe('button');
    expect(spoiler?.getAttribute('tabindex')).toBe('0');
    expect(spoiler?.getAttribute('aria-label')).toBe('rich_text.spoiler_reveal');

    spoiler?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(spoiler?.classList).toContain('is-revealed');
    expect(spoiler?.hasAttribute('role')).toBe(false);
    expect(spoiler?.hasAttribute('aria-label')).toBe(false);
    expect(document.activeElement).toBe(spoiler);
  });

  it('reveals a spoiled link before following it', async () => {
    ask.mockClear();
    const el = render(
      doc('site', [{ type: 'link', attrs: { href: 'https://example.com/' } }, { type: 'spoiler' }]),
    );
    const click = () =>
      el
        .querySelector('a .shelfy-spoiler')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    click();
    await Promise.resolve();
    expect(el.querySelector('.shelfy-spoiler')?.classList).toContain('is-revealed');
    expect(ask).not.toHaveBeenCalled();

    ask.mockResolvedValue(false);
    click();
    await Promise.resolve();
    expect(ask).toHaveBeenCalled();
  });

  it('renders nothing for malformed content instead of throwing', () => {
    const el = render({ type: 'doc', content: [{ type: 'unknown-node' }] });

    expect(el.querySelector('script')).toBeNull();
  });
});
