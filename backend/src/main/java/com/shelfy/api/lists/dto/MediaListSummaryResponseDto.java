package com.shelfy.api.lists.dto;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.collection.dto.MediaResponseDto;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MediaListSummaryResponseDto(
    UUID id,
    UUID userId,
    String name,
    String description,
    CollectionVisibility visibility,
    List<String> tags,
    int itemCount,
    List<MediaResponseDto> previewMedia,
    Integer viewerCompleted,
    long likeCount,
    long commentCount,
    String creatorUsername,
    String creatorAvatarUrl,
    Instant createdAt,
    Instant updatedAt) {}
