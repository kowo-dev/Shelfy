package com.shelfy.api.versus;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

public enum VersusSessionStatus {
  IN_PROGRESS("in_progress"),
  COMPLETED("completed"),
  ABANDONED("abandoned");

  private final String value;

  VersusSessionStatus(String value) {
    this.value = value;
  }

  @JsonValue
  public String getValue() {
    return value;
  }

  @JsonCreator
  public static VersusSessionStatus fromString(String value) {
    return Arrays.stream(values())
        .filter(status -> status.value.equalsIgnoreCase(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown versus session status: " + value));
  }
}
