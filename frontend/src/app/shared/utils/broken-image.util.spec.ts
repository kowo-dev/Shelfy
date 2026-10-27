import { markBrokenImages } from './broken-image.util';

describe('markBrokenImages', () => {
  it('flags an image that fails and clears the flag once it loads', () => {
    const doc = document.implementation.createHTMLDocument();
    markBrokenImages(doc);
    const img = doc.createElement('img');
    doc.body.append(img);

    img.dispatchEvent(new Event('error'));
    expect(img.hasAttribute('data-broken')).toBe(true);

    img.dispatchEvent(new Event('load'));
    expect(img.hasAttribute('data-broken')).toBe(false);
  });
});
