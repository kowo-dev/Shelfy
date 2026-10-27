package com.shelfy.api.collection.dto;

import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaType;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record MediaResponseDto(
    UUID id,
    UUID canonicalWorkId,
    String externalId,
    String provider,
    MediaType mediaType,
    String title,
    String coverUrl,
    Map<String, Object> metadata,
    Instant createdAt,
    boolean isAdult) {

  public static MediaResponseDto of(MediaEntity media) {
    return new MediaResponseDto(
        media.getId(),
        media.getCanonicalWork().getId(),
        media.getExternalId(),
        media.getProvider(),
        media.getMediaType(),
        media.getTitle(),
        media.getCoverUrl(),
        media.getMetadata(),
        media.getCreatedAt(),
        media.isAdult());
  }

  public MediaResponseDto masked() {
    return new MediaResponseDto(
        id, canonicalWorkId, "", provider, mediaType, "", null, Map.of(), createdAt, true);
  }
}
