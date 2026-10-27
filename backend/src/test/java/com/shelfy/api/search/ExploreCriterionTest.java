package com.shelfy.api.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.shelfy.api.search.ExploreCriterion.Kind;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ExploreCriterionTest {

  @Test
  void parse_readsSharedAndNativeTokens() {
    assertEquals(
        new ExploreCriterion(Kind.SHARED, "time-travel"), ExploreCriterion.parse("time-travel"));
    assertEquals(
        new ExploreCriterion(Kind.ANILIST_TAG, "Time Skip"),
        ExploreCriterion.parse("anilist-tag:Time Skip"));
    assertEquals(
        new ExploreCriterion(Kind.PLATFORM, "167"), ExploreCriterion.parse("platform:167"));
    assertEquals("streaming:8", ExploreCriterion.parse("streaming:8").token());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "",
        "Sci Fi",
        "platform:12); limit 500;",
        "igdb-genre:abc",
        "anilist-tag:\"; drop",
        "unknown:12",
        "streaming:-1"
      })
  void parse_rejectsMalformedOrInjectedTokens(String token) {
    assertThrows(IllegalArgumentException.class, () -> ExploreCriterion.parse(token));
  }
}
