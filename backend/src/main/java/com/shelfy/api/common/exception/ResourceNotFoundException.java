package com.shelfy.api.common.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends ApiException {

  public ResourceNotFoundException(ErrorCode code, String message) {
    super(HttpStatus.NOT_FOUND, code, message);
  }
}
