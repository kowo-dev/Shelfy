import type { SearchResult } from '@app/core/services/search/search.model';

export function reviewStudioLink(result: SearchResult): {
  commands: string[];
  queryParams: Record<string, string>;
} {
  return {
    commands: ['/reviews/new'],
    queryParams: {
      provider: result.provider,
      mediaType: result.mediaType,
      externalId: result.externalId,
      title: result.title,
      ...(result.posterPath ? { cover: result.posterPath } : {}),
    },
  };
}
