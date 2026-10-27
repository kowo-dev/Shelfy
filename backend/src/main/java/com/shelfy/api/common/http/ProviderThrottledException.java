package com.shelfy.api.common.http;

import org.springframework.web.client.RestClientException;

public class ProviderThrottledException extends RestClientException {

  public ProviderThrottledException(String provider) {
    super(provider + " request budget exhausted");
  }
}
