import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';
import type { RichTextContent } from '@shared/utils/rich-text.util';
import { RichTextEditorComponent } from './rich-text-editor';

const DOC: RichTextContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dune' }] }],
};

describe('RichTextEditorComponent', () => {
  let fixture: ComponentFixture<RichTextEditorComponent>;
  let component: RichTextEditorComponent;
  let host: HTMLElement;

  const button = (label: string) =>
    host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const linkInput = () => host.querySelector<HTMLInputElement>('.shelfy-rich-text-link input');
  const html = () => component['editor']!.getHTML();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichTextEditorComponent],
      providers: [
        {
          provide: TranslateService,
          useValue: {
            get: (key: string, params?: Record<string, unknown>) =>
              params ? `${key}:${Object.values(params).join()}` : key,
            lang: () => 'en',
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RichTextEditorComponent);
    fixture.componentRef.setInput('content', DOC);
    component = fixture.componentInstance;
    host = fixture.nativeElement;
    await fixture.whenStable();
    component['editor']!.commands.selectAll();
    await fixture.whenStable();
  });

  it('names every toolbar control through translations', () => {
    expect(host.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(
      'rich_text.toolbar',
    );
    const labels = [...host.querySelectorAll('[role="toolbar"] button')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).toEqual([
      'rich_text.heading:1',
      'rich_text.heading:2',
      'rich_text.heading:3',
      'rich_text.bold',
      'rich_text.italic',
      'rich_text.underline',
      'rich_text.strike',
      'rich_text.spoiler',
      'rich_text.bullet_list',
      'rich_text.ordered_list',
      'rich_text.quote',
      'rich_text.add_link',
    ]);
  });

  it('reports the pressed state of a format as the selection changes', async () => {
    expect(button('rich_text.bold').getAttribute('aria-pressed')).toBe('false');

    button('rich_text.bold').click();
    await fixture.whenStable();

    expect(button('rich_text.bold').getAttribute('aria-pressed')).toBe('true');
    expect(html()).toContain('<strong>Dune</strong>');
  });

  it('marks the selection as a spoiler from the toolbar', async () => {
    button('rich_text.spoiler').click();
    await fixture.whenStable();

    expect(button('rich_text.spoiler').getAttribute('aria-pressed')).toBe('true');
    expect(html()).toContain('<span class="shelfy-spoiler">Dune</span>');
    expect(component['editor']!.getJSON().content?.[0].content?.[0].marks).toEqual([
      { type: 'spoiler' },
    ]);
  });

  it('follows formatting applied from the keyboard, outside the toolbar', async () => {
    component['editor']!.commands.toggleItalic();
    await fixture.whenStable();

    expect(button('rich_text.italic').getAttribute('aria-pressed')).toBe('true');
  });

  it('adds a link from the inline field without a browser prompt', async () => {
    const prompt = vi.spyOn(window, 'prompt');

    button('rich_text.add_link').click();
    await fixture.whenStable();
    const input = linkInput()!;
    input.value = 'https://example.com/dune';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();

    expect(prompt).not.toHaveBeenCalled();
    expect(linkInput()).toBeNull();
    expect(html()).toContain('href="https://example.com/dune"');
    expect(button('rich_text.remove_link')).not.toBeNull();
    prompt.mockRestore();
  });

  it('keeps the field open with an error for an address that is not https', async () => {
    button('rich_text.add_link').click();
    await fixture.whenStable();
    const input = linkInput()!;
    input.value = 'javascript:alert(1)';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();

    expect(linkInput()).not.toBeNull();
    expect(host.textContent).toContain('rich_text.link_invalid');
    expect(html()).not.toContain('href');
  });

  it('closes the field on Escape and keeps the event from closing a dialog around it', async () => {
    button('rich_text.add_link').click();
    await fixture.whenStable();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

    linkInput()!.dispatchEvent(escape);
    await fixture.whenStable();

    expect(escape.defaultPrevented).toBe(true);
    expect(linkInput()).toBeNull();
  });
});
