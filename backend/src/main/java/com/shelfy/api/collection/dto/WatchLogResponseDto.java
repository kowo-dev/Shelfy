package com.shelfy.api.collection.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public record WatchLogResponseDto(
    UUID id,
    LocalDate occurredAt,
    boolean isRewatch,
    String name,
    Integer rating,
    Map<String, Object> review,
    boolean containsSpoilers,
    String source,
    Instant createdAt) {}
