package com.shelfy.api.comments;

public enum CommentSortMode {
  RELEVANCE,
  RECENT;

  public static CommentSortMode fromParam(String raw) {
    if (raw == null) {
      return RELEVANCE;
    }
    try {
      return valueOf(raw.trim().toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException("Unknown sort mode: " + raw);
    }
  }
}
