package com.shelfy.api.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class CollectionSortTest {

  @Test
  void recentlyAdded_sortsOnTheCreationDateByDefaultAndWhenAsked() {
    assertEquals("createdAt", CollectionSort.resolve(null, "desc").iterator().next().getProperty());
    assertEquals(
        "createdAt", CollectionSort.resolve("addedAt", "desc").iterator().next().getProperty());
    assertEquals(
        "createdAt", CollectionSort.resolve("unknown", "desc").iterator().next().getProperty());
  }

  @Test
  void recentlyAdded_neverFallsBackToTheModificationDate() {
    Sort sort = CollectionSort.resolve(null, "desc");

    assertTrue(sort.getOrderFor("createdAt").isDescending());
    assertEquals(null, sort.getOrderFor("updatedAt"));
  }

  @Test
  void sortsOnTitleAndUpdateDateWhenAsked() {
    assertNotNull(CollectionSort.resolve("title", "asc").getOrderFor("media.title"));
    assertNotNull(CollectionSort.resolve("updatedAt", "desc").getOrderFor("updatedAt"));
  }
}
