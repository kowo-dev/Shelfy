package com.shelfy.api.feed.dto;

import com.shelfy.api.collection.dto.MediaResponseDto;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record FeedItemDto(
    UUID id,
    String type,
    FeedActorDto actor,
    MediaResponseDto media,
    UUID reviewId,
    Map<String, Object> payload,
    Integer rating,
    Map<String, Object> review,
    boolean containsSpoilers,
    Instant createdAt) {}
