import type { TranslateService } from '@app/core/services/translate/translate';

export interface Contributor {
  username: string;
  avatarUrl: string | null;
}

export function contributorsLabel(
  translate: Pick<TranslateService, 'get'>,
  people: readonly Contributor[],
): string {
  const [first, second] = people;
  if (!first) return '';
  if (people.length === 1) return first.username;
  if (people.length === 2) {
    return translate.get('community.contributors_two', {
      name: first.username,
      other: second.username,
    });
  }
  return translate.get('community.contributors_many', {
    name: first.username,
    count: people.length - 1,
  });
}
