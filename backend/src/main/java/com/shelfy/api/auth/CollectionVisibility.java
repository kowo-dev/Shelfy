package com.shelfy.api.auth;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

public enum CollectionVisibility {
  PUBLIC("public"),
  LINK("link"),
  PRIVATE("private");

  private final String value;

  CollectionVisibility(String value) {
    this.value = value;
  }

  @JsonValue
  public String getValue() {
    return value;
  }

  @JsonCreator
  public static CollectionVisibility fromString(String value) {
    return Arrays.stream(values())
        .filter(visibility -> visibility.value.equalsIgnoreCase(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown collection visibility: " + value));
  }
}
