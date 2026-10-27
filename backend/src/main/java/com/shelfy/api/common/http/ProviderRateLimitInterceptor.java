package com.shelfy.api.common.http;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;

public class ProviderRateLimitInterceptor implements ClientHttpRequestInterceptor {

  private static final Logger LOG = LoggerFactory.getLogger(ProviderRateLimitInterceptor.class);
  private static final Duration DEFAULT_PAUSE = Duration.ofMinutes(1);
  private static final Duration MAX_PAUSE = Duration.ofMinutes(5);
  private static final String REMAINING_HEADER = "X-RateLimit-Remaining";
  private static final String RESET_HEADER = "X-RateLimit-Reset";

  private final ProviderRateLimiter limiter;

  public ProviderRateLimitInterceptor(ProviderRateLimiter limiter) {
    this.limiter = limiter;
  }

  @Override
  public ClientHttpResponse intercept(
      HttpRequest request, byte[] body, ClientHttpRequestExecution execution) throws IOException {
    limiter.acquire();
    ClientHttpResponse response = execution.execute(request, body);
    HttpHeaders headers = response.getHeaders();
    if (response.getStatusCode().value() == 429) {
      Duration pause = retryAfter(headers);
      LOG.warn(
          "{} rate limit hit; pausing requests for {}s", limiter.provider(), pause.toSeconds());
      limiter.pauseFor(pause);
    } else if ("0".equals(headers.getFirst(REMAINING_HEADER))) {
      limiter.pauseFor(untilReset(headers));
    }
    return response;
  }

  private static Duration retryAfter(HttpHeaders headers) {
    Long seconds = parseLong(headers.getFirst(HttpHeaders.RETRY_AFTER));
    return seconds == null ? untilReset(headers) : clamp(Duration.ofSeconds(seconds));
  }

  private static Duration untilReset(HttpHeaders headers) {
    Long resetEpochSeconds = parseLong(headers.getFirst(RESET_HEADER));
    if (resetEpochSeconds == null) {
      return DEFAULT_PAUSE;
    }
    return clamp(Duration.between(Instant.now(), Instant.ofEpochSecond(resetEpochSeconds)));
  }

  private static Duration clamp(Duration pause) {
    if (pause.isNegative()) {
      return Duration.ZERO;
    }
    return pause.compareTo(MAX_PAUSE) > 0 ? MAX_PAUSE : pause;
  }

  private static Long parseLong(String value) {
    if (value == null) {
      return null;
    }
    try {
      return Long.parseLong(value.trim());
    } catch (NumberFormatException ex) {
      return null;
    }
  }
}
