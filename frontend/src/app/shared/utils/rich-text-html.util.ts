import type { JSONContent } from '@tiptap/core';

export interface RichTextHtmlOptions {
  spoiler?: Record<string, string>;
}

type Mark = NonNullable<JSONContent['marks']>[number];

const LINK_ATTRIBUTES = { target: '_blank', rel: 'nofollow ugc noopener noreferrer' };
const ALLOWED_LINK = /^(?:https?|ftps?|mailto|tel|callto|sms|cid|xmpp):/i;
const MARK_ORDER = ['link', 'spoiler', 'bold', 'code', 'italic', 'strike', 'underline'];
const MARK_TAGS: Record<string, string> = {
  bold: 'strong',
  code: 'code',
  italic: 'em',
  strike: 's',
  underline: 'u',
};
const BLOCK_TAGS: Record<string, string> = {
  paragraph: 'p',
  blockquote: 'blockquote',
  bulletList: 'ul',
  listItem: 'li',
};

export function renderRichTextHtml(doc: JSONContent, options: RichTextHtmlOptions = {}): string {
  return blocks(doc.content ?? [], options);
}

function blocks(nodes: readonly JSONContent[], options: RichTextHtmlOptions): string {
  return nodes.map((node) => block(node, options)).join('');
}

function block(node: JSONContent, options: RichTextHtmlOptions): string {
  const children = node.content ?? [];
  switch (node.type) {
    case 'paragraph':
      return `<p>${inline(children, options)}</p>`;
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.['level']) || 1));
      return `<h${level}>${inline(children, options)}</h${level}>`;
    }
    case 'orderedList': {
      const start = Number(node.attrs?.['start']);
      const attr = Number.isInteger(start) && start !== 1 ? ` start="${start}"` : '';
      return `<ol${attr}>${blocks(children, options)}</ol>`;
    }
    case 'codeBlock': {
      const language = node.attrs?.['language'];
      const attr =
        typeof language === 'string' && language ? ` class="language-${escape(language)}"` : '';
      return `<pre><code${attr}>${escape(children.map((child) => child.text ?? '').join(''))}</code></pre>`;
    }
    case 'horizontalRule':
      return '<hr>';
    default: {
      const tag = BLOCK_TAGS[node.type ?? ''];
      return tag ? `<${tag}>${blocks(children, options)}</${tag}>` : '';
    }
  }
}

function inline(nodes: readonly JSONContent[], options: RichTextHtmlOptions): string {
  let html = '';
  const open: Mark[] = [];
  for (const node of nodes) {
    const marks = knownMarks(node.marks ?? []);
    let kept = 0;
    while (kept < open.length && kept < marks.length && sameMark(open[kept], marks[kept])) kept++;
    while (open.length > kept) html += closeTag(open.pop()!);
    for (const mark of marks.slice(kept)) {
      html += openTag(mark, options);
      open.push(mark);
    }
    if (node.type === 'text') html += escape(node.text ?? '');
    else if (node.type === 'hardBreak') html += '<br>';
  }
  while (open.length) html += closeTag(open.pop()!);
  return html;
}

function knownMarks(marks: readonly Mark[]): Mark[] {
  return marks
    .filter((mark) => MARK_ORDER.includes(mark.type))
    .sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
}

function sameMark(a: Mark, b: Mark): boolean {
  return a.type === b.type && JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {});
}

function openTag(mark: Mark, options: RichTextHtmlOptions): string {
  if (mark.type === 'link') {
    const href = String(mark.attrs?.['href'] ?? '').trim();
    return `<a${attributes({ ...LINK_ATTRIBUTES, href: ALLOWED_LINK.test(href) ? href : '' })}>`;
  }
  if (mark.type === 'spoiler') {
    return `<span${attributes({ ...options.spoiler, class: 'shelfy-spoiler' })}>`;
  }
  return `<${MARK_TAGS[mark.type]}>`;
}

function closeTag(mark: Mark): string {
  if (mark.type === 'link') return '</a>';
  if (mark.type === 'spoiler') return '</span>';
  return `</${MARK_TAGS[mark.type]}>`;
}

function attributes(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([name, value]) => ` ${name}="${escape(value)}"`)
    .join('');
}

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
