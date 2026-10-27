package com.shelfy.api.activity;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class UserActivityEntityTest {

  @Test
  void merge_keepsTheRatingFromBeforeTheFirstChange() {
    UserActivityEntity activity =
        new UserActivityEntity(
            UUID.randomUUID(), null, ActivityType.RATED, Map.of("rating", 6, "previous", 3));

    activity.merge(Map.of("rating", 9, "previous", 6));

    assertEquals(Map.of("rating", 9, "previous", 3), activity.getPayload());
  }
}
