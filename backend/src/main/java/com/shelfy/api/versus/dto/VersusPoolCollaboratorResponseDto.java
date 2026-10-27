package com.shelfy.api.versus.dto;

import com.shelfy.api.lists.ListCollaboratorStatus;
import java.time.Instant;
import java.util.UUID;

public record VersusPoolCollaboratorResponseDto(
    UUID id,
    UUID poolId,
    UUID userId,
    String username,
    String displayName,
    String avatarUrl,
    ListCollaboratorStatus status,
    UUID invitedBy,
    Instant createdAt,
    Instant updatedAt) {}
