import { provideUiIcons } from './ui-icons';

describe('provideUiIcons', () => {
  it('returns a non-empty array of providers', () => {
    const providers = provideUiIcons();

    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
  });

  it('returns a fresh array on each call', () => {
    const first = provideUiIcons();
    const second = provideUiIcons();

    expect(first).not.toBe(second);
    expect(first.length).toBe(second.length);
  });
});
