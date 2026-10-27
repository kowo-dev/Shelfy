package com.shelfy.api.notifications.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record NotificationResponseDto(
    UUID id,
    String type,
    String family,
    NotificationActorDto actor,
    List<NotificationActorDto> actors,
    int actorCount,
    String targetType,
    UUID targetId,
    Map<String, Object> payload,
    Instant createdAt,
    Instant updatedAt,
    boolean isRead,
    boolean isResolved) {}
