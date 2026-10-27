package com.shelfy.api.community;

import com.shelfy.api.collection.MediaType;
import java.util.List;
import java.util.Locale;

public record CommunityFilter(
    String query, CommunityScope scope, MediaType mediaType, CommunitySort sort) {

  public static final CommunityFilter NONE =
      new CommunityFilter(null, CommunityScope.ALL, null, CommunitySort.RECENT);

  public static final int MAX_QUERY_LENGTH = 100;

  public CommunityFilter {
    scope = scope == null ? CommunityScope.ALL : scope;
    sort = sort == null ? CommunitySort.RECENT : sort;
  }

  public String likePattern() {
    return likePattern(query);
  }

  public static String likePattern(String query) {
    if (query == null) {
      return "";
    }
    String cleaned = query.replaceAll("[%_\\\\]", " ").trim().toLowerCase(Locale.ROOT);
    if (cleaned.isEmpty()) {
      return "";
    }
    return "%" + cleaned.substring(0, Math.min(cleaned.length(), MAX_QUERY_LENGTH)) + "%";
  }

  public boolean anyType() {
    return mediaType == null;
  }

  public List<MediaType> types() {
    return mediaType == null ? List.of(MediaType.values()) : List.of(mediaType);
  }

  public boolean mineOnly() {
    return scope == CommunityScope.MINE;
  }

  public boolean circleOnly() {
    return scope == CommunityScope.CIRCLE;
  }

  public boolean remoteOnly() {
    return scope == CommunityScope.REMOTE;
  }

  public boolean popular() {
    return sort == CommunitySort.POPULAR;
  }
}
