package com.shelfy.api.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class UserMediaStatusTest {

  @Test
  void readsEveryStatusByItsValue() {
    assertEquals(UserMediaStatus.PLANNED, UserMediaStatus.fromString("planned"));
    assertEquals(UserMediaStatus.ONGOING, UserMediaStatus.fromString("ONGOING"));
    assertEquals(UserMediaStatus.DONE, UserMediaStatus.fromString("done"));
    assertEquals(UserMediaStatus.DROPPED, UserMediaStatus.fromString("dropped"));
  }

  @Test
  void readsTheRetiredEndlessStatusAsDone() {
    assertEquals(Optional.of(UserMediaStatus.DONE), UserMediaStatus.parse("endless"));
    assertEquals(UserMediaStatus.DONE, UserMediaStatus.fromString("endless"));
  }

  @Test
  void rejectsAnUnknownStatus() {
    assertTrue(UserMediaStatus.parse("binging").isEmpty());
    assertThrows(IllegalArgumentException.class, () -> UserMediaStatus.fromString("binging"));
  }
}
