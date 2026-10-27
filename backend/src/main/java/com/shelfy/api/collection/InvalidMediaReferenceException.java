package com.shelfy.api.collection;

import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;

public class InvalidMediaReferenceException extends BadRequestException {

  public InvalidMediaReferenceException() {
    super(ErrorCode.INVALID_MEDIA_REFERENCE, "Invalid media reference");
  }
}
