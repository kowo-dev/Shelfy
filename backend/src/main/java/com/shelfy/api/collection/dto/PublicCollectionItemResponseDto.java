package com.shelfy.api.collection.dto;

import com.shelfy.api.collection.UserMediaStatus;
import java.time.Instant;
import java.util.UUID;

public record PublicCollectionItemResponseDto(
    UUID id,
    MediaResponseDto media,
    UserMediaStatus status,
    Integer rating,
    Instant createdAt,
    Instant updatedAt) {}
