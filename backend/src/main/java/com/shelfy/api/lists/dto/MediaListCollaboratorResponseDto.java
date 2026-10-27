package com.shelfy.api.lists.dto;

import com.shelfy.api.lists.ListCollaboratorStatus;
import java.time.Instant;
import java.util.UUID;

public record MediaListCollaboratorResponseDto(
    UUID id,
    UUID listId,
    UUID userId,
    String username,
    String displayName,
    String avatarUrl,
    ListCollaboratorStatus status,
    UUID invitedBy,
    Instant createdAt,
    Instant updatedAt) {}
