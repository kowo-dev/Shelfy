package com.shelfy.api.common.http;

import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;

public final class ProviderRateLimiter {

  public static final ScopedValue<Duration> MAX_WAIT = ScopedValue.newInstance();
  public static final Duration DEFAULT_MAX_WAIT = Duration.ofSeconds(2);

  private final String provider;
  private final long intervalNanos;
  private final long burstToleranceNanos;
  private final LongSupplier nanoClock;
  private long theoreticalArrivalNanos;
  private long pausedUntilNanos;

  public ProviderRateLimiter(String provider, int requestsPerMinute, int burst) {
    this(provider, requestsPerMinute, burst, System::nanoTime);
  }

  ProviderRateLimiter(String provider, int requestsPerMinute, int burst, LongSupplier nanoClock) {
    if (requestsPerMinute < 1 || burst < 1) {
      throw new IllegalArgumentException("Rate and burst must be positive");
    }
    this.provider = provider;
    this.intervalNanos = TimeUnit.MINUTES.toNanos(1) / requestsPerMinute;
    this.burstToleranceNanos = (burst - 1) * intervalNanos;
    this.nanoClock = nanoClock;
    long now = nanoClock.getAsLong();
    this.theoreticalArrivalNanos = now;
    this.pausedUntilNanos = now;
  }

  public String provider() {
    return provider;
  }

  public void acquire() {
    Duration maxWait = MAX_WAIT.orElse(DEFAULT_MAX_WAIT);
    long waitNanos = reserve(maxWait.toNanos());
    if (waitNanos < 0) {
      throw new ProviderThrottledException(provider);
    }
    if (waitNanos > 0) {
      sleep(waitNanos);
    }
  }

  public synchronized void pauseFor(Duration pause) {
    pausedUntilNanos = Math.max(pausedUntilNanos, nanoClock.getAsLong() + pause.toNanos());
  }

  synchronized long reserve(long maxWaitNanos) {
    long now = nanoClock.getAsLong();
    long earliest = Math.max(now, pausedUntilNanos);
    long arrival = Math.max(theoreticalArrivalNanos, earliest);
    long allowedAt = Math.max(earliest, arrival - burstToleranceNanos);
    long waitNanos = allowedAt - now;
    if (waitNanos > maxWaitNanos) {
      return -1;
    }
    theoreticalArrivalNanos = Math.max(arrival, allowedAt) + intervalNanos;
    return waitNanos;
  }

  private void sleep(long nanos) {
    try {
      TimeUnit.NANOSECONDS.sleep(nanos);
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      throw new ProviderThrottledException(provider);
    }
  }
}
