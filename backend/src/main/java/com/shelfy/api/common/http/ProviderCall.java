package com.shelfy.api.common.http;

import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

public final class ProviderCall {

  private static final Logger LOG = LoggerFactory.getLogger(ProviderCall.class);
  private static final int MAX_ATTEMPTS = 2;
  private static final long RETRY_DELAY_MS = 250;
  private static final long MAX_RETRY_DELAY_MS = 5_000;

  public record Provider(String name, ErrorCode notFound, ErrorCode unavailable) {}

  private ProviderCall() {}

  public static <T> T execute(Provider provider, String endpoint, Supplier<T> request) {
    for (int attempt = 1; ; attempt++) {
      try {
        return request.get();
      } catch (HttpClientErrorException.NotFound ex) {
        if (provider.notFound() == null) {
          throw unavailable(provider, endpoint, attempt, ex);
        }
        throw new ResourceNotFoundException(
            provider.notFound(), provider.name() + " resource not found");
      } catch (RestClientException ex) {
        if (!isTransient(ex) || attempt == MAX_ATTEMPTS) {
          throw unavailable(provider, endpoint, attempt, ex);
        }
        LOG.warn(
            "{} request to {} failed; retrying: {}",
            provider.name(),
            endpoint,
            LogSafe.describe(ex));
        pause(retryDelayMs(ex));
      }
    }
  }

  private static long retryDelayMs(RestClientException ex) {
    if (ex instanceof RestClientResponseException response) {
      String header =
          response.getResponseHeaders() == null
              ? null
              : response.getResponseHeaders().getFirst("Retry-After");
      if (header != null) {
        try {
          long seconds = Long.parseLong(header.trim());
          return Math.clamp(seconds * 1000, RETRY_DELAY_MS, MAX_RETRY_DELAY_MS);
        } catch (NumberFormatException ignored) {
          return RETRY_DELAY_MS;
        }
      }
    }
    return RETRY_DELAY_MS;
  }

  private static ApiException unavailable(
      Provider provider, String endpoint, int attempts, RestClientException ex) {
    LOG.warn(
        "{} request to {} failed after {} attempt(s): {}",
        provider.name(),
        endpoint,
        attempts,
        LogSafe.describe(ex));
    return new ApiException(
        HttpStatus.BAD_GATEWAY, provider.unavailable(), provider.name() + " request failed", ex);
  }

  private static boolean isTransient(RestClientException ex) {
    if (ex instanceof ResourceAccessException) {
      return true;
    }
    return ex instanceof RestClientResponseException response
        && (response.getStatusCode().value() == 429 || response.getStatusCode().is5xxServerError());
  }

  private static void pause(long delayMs) {
    try {
      Thread.sleep(delayMs);
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
    }
  }
}
