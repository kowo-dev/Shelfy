import type { JSONContent } from '@tiptap/core';

export type RichTextContent = Record<string, unknown>;

export const SPOILER_MASK = '▒▒▒';

const EMPTY_DOCUMENT: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

export function richTextDocument(content: RichTextContent | null): JSONContent {
  if (content?.['type'] === 'doc') return content as JSONContent;
  return legacyDeltaDocument(content);
}

export function richTextPlainText(content: RichTextContent | null): string {
  return plainText(richTextDocument(content), false).trim();
}

export function isRichTextEmpty(content: RichTextContent | null): boolean {
  return richTextPlainText(content) === '';
}

export function richTextExcerpt(content: RichTextContent | null, maxLength = 280): string {
  const text = plainText(richTextDocument(content), true)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(▒▒▒)+/g, SPOILER_MASK);
  if (text.length <= maxLength) return text;
  return `${text
    .slice(0, maxLength)
    .replace(/\s+\S*$/, '')
    .trim()}…`;
}

function legacyDeltaDocument(content: RichTextContent | null): JSONContent {
  const ops = content?.['ops'];
  if (!Array.isArray(ops)) return EMPTY_DOCUMENT;
  const blocks: JSONContent[] = [];
  let line: JSONContent[] = [];

  for (const operation of ops) {
    const op = operation as { insert?: unknown; attributes?: unknown } | null;
    if (!op || typeof op.insert !== 'string') continue;
    const attrs = attributes(op.attributes);
    const parts = op.insert.split('\n');
    for (const [index, part] of parts.entries()) {
      if (part) line.push(textNode(part, attrs));
      if (index < parts.length - 1) {
        appendBlock(blocks, line, attrs);
        line = [];
      }
    }
  }
  if (line.length || blocks.length === 0) appendBlock(blocks, line, {});
  return { type: 'doc', content: blocks };
}

function appendBlock(
  blocks: JSONContent[],
  content: JSONContent[],
  attrs: Record<string, unknown>,
): void {
  const paragraph: JSONContent = { type: 'paragraph', content };
  const listType =
    attrs['list'] === 'bullet' ? 'bulletList' : attrs['list'] === 'ordered' ? 'orderedList' : null;
  if (listType) {
    const last = blocks.at(-1);
    if (last?.type === listType) {
      last.content?.push({ type: 'listItem', content: [paragraph] });
    } else {
      blocks.push({ type: listType, content: [{ type: 'listItem', content: [paragraph] }] });
    }
    return;
  }
  if (attrs['header'] === 1 || attrs['header'] === 2 || attrs['header'] === 3) {
    blocks.push({ type: 'heading', attrs: { level: attrs['header'] }, content });
  } else if (attrs['blockquote']) {
    blocks.push({ type: 'blockquote', content: [paragraph] });
  } else {
    blocks.push(paragraph);
  }
}

function textNode(text: string, attrs: Record<string, unknown>): JSONContent {
  const textMarks = marks(attrs);
  return textMarks.length ? { type: 'text', text, marks: textMarks } : { type: 'text', text };
}

function marks(attrs: Record<string, unknown>): NonNullable<JSONContent['marks']> {
  return [
    attrs['bold'] ? { type: 'bold' } : null,
    attrs['italic'] ? { type: 'italic' } : null,
    attrs['underline'] ? { type: 'underline' } : null,
    attrs['strike'] ? { type: 'strike' } : null,
  ].filter((mark): mark is NonNullable<typeof mark> => mark !== null);
}

function attributes(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function plainText(node: JSONContent, maskSpoilers: boolean): string {
  if (node.type === 'text') {
    return maskSpoilers && node.marks?.some((mark) => mark.type === 'spoiler')
      ? SPOILER_MASK
      : (node.text ?? '');
  }
  const text = (node.content ?? []).map((child) => plainText(child, maskSpoilers)).join('');
  return ['paragraph', 'heading', 'blockquote', 'listItem'].includes(node.type ?? '')
    ? `${text}\n`
    : text;
}
