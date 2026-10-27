package com.shelfy.api.versus.dto;

import com.shelfy.api.auth.CollectionVisibility;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record VersusPoolSummaryResponseDto(
    UUID id,
    UUID userId,
    String name,
    String description,
    CollectionVisibility visibility,
    int itemCount,
    List<VersusEntryResponseDto> previewEntries,
    long likeCount,
    long commentCount,
    String creatorUsername,
    String creatorAvatarUrl,
    Instant createdAt,
    Instant updatedAt) {}
