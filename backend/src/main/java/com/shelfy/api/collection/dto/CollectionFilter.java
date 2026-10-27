package com.shelfy.api.collection.dto;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.UserMediaStatus;
import java.util.List;

public record CollectionFilter(
    List<UserMediaStatus> status,
    List<MediaType> mediaType,
    Boolean includeUnrated,
    Integer minRating,
    Integer maxRating,
    String search,
    Boolean hasNote) {

  public List<UserMediaStatus> statusesOrNull() {
    return status == null || status.isEmpty() ? null : status;
  }

  public List<MediaType> mediaTypesOrNull() {
    return mediaType == null || mediaType.isEmpty() ? null : mediaType;
  }

  public boolean includesUnrated() {
    return includeUnrated == null || includeUnrated;
  }

  public boolean onlyWithNote() {
    return Boolean.TRUE.equals(hasNote);
  }
}
