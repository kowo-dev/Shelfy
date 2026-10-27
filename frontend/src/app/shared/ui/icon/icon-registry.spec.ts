import { svgFor } from './icon-registry';

describe('svgFor', () => {
  it('returns the outline variant for a plain name', () => {
    expect(svgFor('home')).toContain('<svg');
  });

  it('returns the filled variant when the name carries the Active suffix', () => {
    expect(svgFor('homeActive')).toContain('<svg');
    expect(svgFor('homeActive')).not.toBe(svgFor('home'));
  });

  it('falls back to the outline when an icon has no filled variant', () => {
    expect(svgFor('rowsActive')).toBe(svgFor('rows'));
  });

  it('returns null for an unknown icon', () => {
    expect(svgFor('doesNotExist')).toBeNull();
    expect(svgFor('doesNotExistActive')).toBeNull();
  });
});
