package com.shelfy.api.versus;

public enum ClipProvider {
  YOUTUBE("youtube");

  private final String value;

  ClipProvider(String value) {
    this.value = value;
  }

  public String value() {
    return value;
  }
}
