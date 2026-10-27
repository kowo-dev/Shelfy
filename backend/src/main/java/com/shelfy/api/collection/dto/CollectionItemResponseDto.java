package com.shelfy.api.collection.dto;

import com.shelfy.api.collection.UserMediaStatus;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record CollectionItemResponseDto(
    UUID id,
    UUID userId,
    MediaResponseDto media,
    UserMediaStatus status,
    Integer rating,
    Map<String, Object> note,
    boolean containsSpoilers,
    Map<String, Object> progress,
    Instant createdAt,
    Instant updatedAt,
    EpisodeSummaryDto episodeSummary) {

  public CollectionItemResponseDto maskedIfAdult(boolean adultContentAllowed) {
    if (adultContentAllowed || !media.isAdult()) {
      return this;
    }
    return new CollectionItemResponseDto(
        id, userId, media.masked(), status, rating, null, false, null, createdAt, updatedAt, null);
  }
}
