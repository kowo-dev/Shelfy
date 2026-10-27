import { contributorsLabel } from './contributors';

const translate = {
  get: (key: string, params?: Record<string, unknown>) => `${key}:${JSON.stringify(params)}`,
};
const person = (username: string) => ({ username, avatarUrl: null });

describe('contributorsLabel', () => {
  it('names a lone author, pairs two people and counts the rest', () => {
    expect(contributorsLabel(translate, [])).toBe('');
    expect(contributorsLabel(translate, [person('kowo')])).toBe('kowo');
    expect(contributorsLabel(translate, [person('kowo'), person('ines')])).toBe(
      'community.contributors_two:{"name":"kowo","other":"ines"}',
    );
    expect(contributorsLabel(translate, [person('kowo'), person('ines'), person('lea')])).toBe(
      'community.contributors_many:{"name":"kowo","count":2}',
    );
  });
});
