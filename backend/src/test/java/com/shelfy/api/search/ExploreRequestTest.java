package com.shelfy.api.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.shelfy.api.collection.MediaType;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class ExploreRequestTest {

  @Test
  void constructor_normalizesQueryAndDeduplicatesCriteria() {
    ExploreCriterion scienceFiction = ExploreCriterion.parse("science-fiction");
    ExploreRequest request =
        new ExploreRequest(
            null,
            "  dune ",
            List.of(scienceFiction, scienceFiction),
            null,
            2010,
            2019,
            null,
            1,
            "FR");

    assertEquals("dune", request.query());
    assertEquals(List.of(scienceFiction), request.with());
    assertEquals(List.of(), request.without());
    assertEquals(ExploreSort.POPULAR, request.sort());
    assertFalse(request.isPlainSearch());
  }

  @Test
  void isPlainSearch_whenOnlyTextIsGiven() {
    assertTrue(
        new ExploreRequest(MediaType.MOVIE, "dune", null, null, null, null, null, 1, "FR")
            .isPlainSearch());
  }

  @Test
  void constructor_rejectsInvalidParameters() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new ExploreRequest(MediaType.BOOK, "", null, null, null, null, null, 1, "FR"));
    assertThrows(
        IllegalArgumentException.class,
        () -> new ExploreRequest(null, "", null, null, 2020, 2010, null, 1, "FR"));
    assertThrows(
        IllegalArgumentException.class,
        () -> new ExploreRequest(null, "", null, null, null, null, null, 0, "FR"));
    assertThrows(
        IllegalArgumentException.class,
        () -> new ExploreRequest(null, "", null, null, null, null, null, 1, "fr"));
    List<ExploreCriterion> tooMany =
        IntStream.rangeClosed(1, 13)
            .mapToObj(id -> ExploreCriterion.parse("igdb-genre:" + id))
            .toList();
    assertThrows(
        IllegalArgumentException.class,
        () -> new ExploreRequest(null, "", tooMany, null, null, null, null, 1, "FR"));
  }
}
