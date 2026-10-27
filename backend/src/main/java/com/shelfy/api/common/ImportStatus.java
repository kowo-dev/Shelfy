package com.shelfy.api.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

public enum ImportStatus {
  PENDING("pending"),
  PROCESSING("processing"),
  COMPLETED("completed"),
  FAILED("failed");

  private final String value;

  ImportStatus(String value) {
    this.value = value;
  }

  @JsonValue
  public String getValue() {
    return value;
  }

  @JsonCreator
  public static ImportStatus fromString(String value) {
    return Arrays.stream(values())
        .filter(status -> status.value.equalsIgnoreCase(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown import status: " + value));
  }
}
