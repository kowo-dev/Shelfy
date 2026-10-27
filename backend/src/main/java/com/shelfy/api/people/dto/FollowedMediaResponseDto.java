package com.shelfy.api.people.dto;

import com.shelfy.api.collection.UserMediaStatus;
import java.time.Instant;

public record FollowedMediaResponseDto(
    String username,
    String displayName,
    String avatarUrl,
    UserMediaStatus status,
    Integer rating,
    long viewCount,
    Instant updatedAt) {}
