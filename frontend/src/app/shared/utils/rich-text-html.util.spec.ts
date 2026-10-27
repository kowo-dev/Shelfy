import { generateHTML, type JSONContent } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { Spoiler } from '@shared/ui/rich-text/spoiler-mark';
import { richTextDocument } from './rich-text.util';
import { renderRichTextHtml } from './rich-text-html.util';

const SPOILER = { role: 'button', tabindex: '0', 'aria-label': 'Reveal' };
const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, underline: false }),
  Underline,
  Link.configure({ HTMLAttributes: { rel: 'nofollow ugc noopener noreferrer', target: '_blank' } }),
  Spoiler.configure({ HTMLAttributes: SPOILER }),
];

const text = (value: string, ...marks: JSONContent['marks'] & object): JSONContent =>
  marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value };
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });
const link = (href: string) => ({ type: 'link', attrs: { href } });

function dom(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

function expectSameAsTiptap(content: JSONContent): void {
  const ours = dom(renderRichTextHtml(content, { spoiler: SPOILER }));
  const tiptap = dom(generateHTML(content, extensions));
  expect(ours.isEqualNode(tiptap), `${renderRichTextHtml(content, { spoiler: SPOILER })}`).toBe(
    true,
  );
}

describe('renderRichTextHtml', () => {
  it('matches Tiptap for formatting marks', () => {
    expectSameAsTiptap(
      doc(
        paragraph(
          text('plain '),
          text('bold', { type: 'bold' }),
          text(' '),
          text('both', { type: 'bold' }, { type: 'italic' }),
          text(' under', { type: 'underline' }),
          text(' gone', { type: 'strike' }),
          text(' x = 1', { type: 'code' }),
        ),
      ),
    );
  });

  it('matches Tiptap for headings, lists, quotes, breaks and rules', () => {
    expectSameAsTiptap(
      doc(
        { type: 'heading', attrs: { level: 1 }, content: [text('One')] },
        { type: 'heading', attrs: { level: 3 }, content: [text('Three')] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [paragraph(text('a'))] },
            { type: 'listItem', content: [paragraph(text('b'))] },
          ],
        },
        {
          type: 'orderedList',
          attrs: { start: 3 },
          content: [{ type: 'listItem', content: [paragraph(text('c'))] }],
        },
        { type: 'blockquote', content: [paragraph(text('quoted'))] },
        paragraph(text('line'), { type: 'hardBreak' }, text('next')),
        { type: 'horizontalRule' },
        paragraph(),
      ),
    );
  });

  it('matches Tiptap for links, spoilers and spoilers spanning formatting', () => {
    expectSameAsTiptap(
      doc(
        paragraph(text('site', link('https://example.com/'))),
        paragraph(text('hidden', link('https://example.com/'), { type: 'spoiler' })),
        paragraph(
          text('the ', { type: 'spoiler' }),
          text('butler', { type: 'spoiler' }, { type: 'bold' }),
          text(' did it', { type: 'spoiler' }),
        ),
      ),
    );
  });

  it('keeps a spoiler that spans bold text in one element', () => {
    const html = renderRichTextHtml(
      doc(
        paragraph(
          text('the ', { type: 'spoiler' }),
          text('butler', { type: 'spoiler' }, { type: 'bold' }),
        ),
      ),
    );

    expect(dom(html).querySelectorAll('.shelfy-spoiler')).toHaveLength(1);
  });

  it('matches Tiptap for legacy Quill documents', () => {
    expectSameAsTiptap(
      richTextDocument({
        ops: [
          { insert: 'Title' },
          { insert: '\n', attributes: { header: 2 } },
          { insert: 'bold', attributes: { bold: true } },
          { insert: ' and plain\nitem' },
          { insert: '\n', attributes: { list: 'bullet' } },
        ],
      }),
    );
  });

  it('escapes text and attributes', () => {
    const html = renderRichTextHtml(
      doc(paragraph(text('<b>"hi"</b> & co', link('https://x.test/?a="b"&c=<d>')))),
    );

    expect(html).toContain('&lt;b&gt;&quot;hi&quot;&lt;/b&gt; &amp; co');
    expect(dom(html).querySelector('a')?.getAttribute('href')).toBe('https://x.test/?a="b"&c=<d>');
  });

  it('drops links that are not web, mail or phone links', () => {
    for (const href of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x']) {
      const html = renderRichTextHtml(doc(paragraph(text('x', link(href)))));
      expect(dom(html).querySelector('a')?.getAttribute('href')).toBe('');
    }
  });

  it('skips unknown nodes and marks', () => {
    expect(
      renderRichTextHtml(doc({ type: 'iframe' }, paragraph(text('ok', { type: 'highlight' })))),
    ).toBe('<p>ok</p>');
  });
});
