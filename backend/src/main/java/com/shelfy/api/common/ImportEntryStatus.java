package com.shelfy.api.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

public enum ImportEntryStatus {
  IMPORTED("imported"),
  SKIPPED("skipped");

  private final String value;

  ImportEntryStatus(String value) {
    this.value = value;
  }

  @JsonValue
  public String getValue() {
    return value;
  }

  @JsonCreator
  public static ImportEntryStatus fromString(String value) {
    return Arrays.stream(values())
        .filter(status -> status.value.equalsIgnoreCase(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown import entry status: " + value));
  }
}
