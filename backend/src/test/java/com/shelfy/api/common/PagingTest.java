package com.shelfy.api.common;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class PagingTest {

  @Test
  void of_capsTheSizeAndFloorsPageAndSize() {
    assertEquals(Paging.MAX_PAGE_SIZE, Paging.of(0, 100_000).getPageSize());
    assertEquals(1, Paging.of(0, 0).getPageSize());
    assertEquals(0, Paging.of(-3, 20).getPageNumber());
    assertEquals(20, Paging.of(2, 20).getPageSize());
  }
}
