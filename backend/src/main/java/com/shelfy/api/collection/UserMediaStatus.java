package com.shelfy.api.collection;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.Optional;

public enum UserMediaStatus {
  PLANNED("planned"),
  ONGOING("ongoing"),
  DONE("done"),
  DROPPED("dropped");

  private static final String LEGACY_ENDLESS = "endless";

  private final String value;

  UserMediaStatus(String value) {
    this.value = value;
  }

  @JsonValue
  public String getValue() {
    return value;
  }

  @JsonCreator
  public static UserMediaStatus fromString(String value) {
    return parse(value)
        .orElseThrow(() -> new IllegalArgumentException("Unknown user media status: " + value));
  }

  public static Optional<UserMediaStatus> parse(String value) {
    if (LEGACY_ENDLESS.equalsIgnoreCase(value)) {
      return Optional.of(DONE);
    }
    return Arrays.stream(values())
        .filter(status -> status.value.equalsIgnoreCase(value))
        .findFirst();
  }
}
