package com.shelfy.api.common.http;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class ProviderRateLimiterTest {

  private static final long SECOND = Duration.ofSeconds(1).toNanos();

  private final AtomicLong now = new AtomicLong();
  private final ProviderRateLimiter limiter = new ProviderRateLimiter("Test", 60, 3, now::get);

  @Test
  void reserve_letsABurstThroughThenSpacesRequests() {
    assertEquals(0, limiter.reserve(0));
    assertEquals(0, limiter.reserve(0));
    assertEquals(0, limiter.reserve(0));
    assertEquals(-1, limiter.reserve(0));
    assertEquals(SECOND, limiter.reserve(2 * SECOND));
    assertEquals(2 * SECOND, limiter.reserve(2 * SECOND));
  }

  @Test
  void reserve_refillsOverTime() {
    for (int i = 0; i < 3; i++) {
      limiter.reserve(0);
    }
    now.addAndGet(2 * SECOND);
    assertEquals(0, limiter.reserve(0));
    assertEquals(0, limiter.reserve(0));
    assertEquals(-1, limiter.reserve(0));
  }

  @Test
  void reserve_rejectsDuringAPauseLongerThanTheAllowedWait() {
    limiter.pauseFor(Duration.ofSeconds(30));
    assertEquals(-1, limiter.reserve(2 * SECOND));
    now.addAndGet(29 * SECOND);
    assertEquals(SECOND, limiter.reserve(2 * SECOND));
  }
}
