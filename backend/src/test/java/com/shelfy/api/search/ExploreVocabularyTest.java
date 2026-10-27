package com.shelfy.api.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.shelfy.api.collection.MediaType;
import org.junit.jupiter.api.Test;

class ExploreVocabularyTest {

  private final ExploreVocabulary vocabulary = new ExploreVocabulary();

  @Test
  void entries_haveUniqueParseableIds() {
    assertThat(vocabulary.entries())
        .extracting(ExploreVocabulary.Entry::id)
        .doesNotHaveDuplicates()
        .allSatisfy(id -> ExploreCriterion.parse(id));
  }

  @Test
  void entries_exposeTheMediaTypesTheyCanReach() {
    assertThat(vocabulary.find("science-fiction").orElseThrow().mediaTypes())
        .containsExactly(
            MediaType.MOVIE,
            MediaType.TV_SHOW,
            MediaType.ANIME,
            MediaType.MANGA,
            MediaType.WEBTOON,
            MediaType.GAME);
    assertThat(vocabulary.find("open-world").orElseThrow().mediaTypes())
        .containsExactly(MediaType.GAME);
  }
}
