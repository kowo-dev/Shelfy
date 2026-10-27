import {
  isRichTextEmpty,
  richTextDocument,
  richTextExcerpt,
  richTextPlainText,
} from './rich-text.util';

describe('rich text utilities', () => {
  it('reads existing Quill Deltas without losing supported formatting', () => {
    expect(
      richTextDocument({
        ops: [
          { insert: 'Great', attributes: { bold: true } },
          { insert: '\n', attributes: { header: 2 } },
          { insert: 'film.' },
        ],
      }),
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Great', marks: [{ type: 'bold' }] }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'film.' }] },
      ],
    });
  });

  it('extracts and truncates structured content', () => {
    const content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'word '.repeat(100) }] }],
    };
    expect(richTextPlainText(content)).toBe('word '.repeat(100).trim());
    expect(richTextExcerpt(content, 20)).toBe('word word word word…');
  });

  it('masks spoiler text in excerpts but keeps it in plain text', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'The killer is ' },
            { type: 'text', text: 'the', marks: [{ type: 'bold' }, { type: 'spoiler' }] },
            { type: 'text', text: ' butler', marks: [{ type: 'spoiler' }] },
            { type: 'text', text: '.' },
          ],
        },
      ],
    };
    expect(richTextExcerpt(content)).toBe('The killer is ▒▒▒.');
    expect(richTextPlainText(content)).toBe('The killer is the butler.');
  });

  it('recognizes an empty document', () => {
    expect(isRichTextEmpty({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
  });
});
