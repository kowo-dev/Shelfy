package com.shelfy.api.common.exception;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

class GlobalExceptionHandlerTest {

  @Test
  void illegalArgumentException_doesNotExposeItsMessage() {
    String internalMessage = "Unknown media type: private-detail";
    ProblemDetail problem =
        new GlobalExceptionHandler()
            .handleIllegalArgument(new IllegalArgumentException(internalMessage));

    assertEquals(HttpStatus.BAD_REQUEST.value(), problem.getStatus());
    assertEquals("Validation failed", problem.getDetail());
    assertNotEquals(internalMessage, problem.getDetail());
    assertEquals(ErrorCode.VALIDATION_FAILED.name(), problem.getProperties().get("code"));
  }
}
