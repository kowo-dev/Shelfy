package com.shelfy.api.collection;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

public enum MediaType {
  MOVIE("movie"),
  TV_SHOW("tv_show"),
  ANIME("anime"),
  MANGA("manga"),
  WEBTOON("webtoon"),
  BOOK("book"),
  GAME("game");

  private final String value;

  MediaType(String value) {
    this.value = value;
  }

  @JsonValue
  public String getValue() {
    return value;
  }

  @JsonCreator
  public static MediaType fromString(String value) {
    return Arrays.stream(values())
        .filter(type -> type.value.equalsIgnoreCase(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown media type: " + value));
  }
}
