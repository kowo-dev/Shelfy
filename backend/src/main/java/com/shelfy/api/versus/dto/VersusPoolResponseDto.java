package com.shelfy.api.versus.dto;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.comments.dto.CommentResponseDto;
import com.shelfy.api.lists.ListCollaboratorStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record VersusPoolResponseDto(
    UUID id,
    UUID userId,
    String name,
    String description,
    CollectionVisibility visibility,
    List<VersusEntryResponseDto> entries,
    boolean canEdit,
    boolean isOwner,
    boolean isLikedByViewer,
    long likeCount,
    List<CommentResponseDto> comments,
    long commentCount,
    String creatorUsername,
    String creatorAvatarUrl,
    List<VersusPoolCollaboratorResponseDto> collaborators,
    List<VersusPoolCollaboratorResponseDto> pendingInvites,
    ListCollaboratorStatus viewerCollaboratorStatus,
    VersusPoolSourceDto source,
    Instant createdAt,
    Instant updatedAt) {}
