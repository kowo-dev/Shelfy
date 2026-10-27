package com.shelfy.api.common.exception;

import org.springframework.http.HttpStatus;

public class ForbiddenException extends ApiException {

  public ForbiddenException(ErrorCode code, String message) {
    super(HttpStatus.FORBIDDEN, code, message);
  }
}
