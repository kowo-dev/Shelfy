package com.shelfy.api.lists.dto;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.collection.dto.MediaResponseDto;
import com.shelfy.api.comments.dto.CommentResponseDto;
import com.shelfy.api.lists.ListCollaboratorStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MediaListResponseDto(
    UUID id,
    UUID userId,
    String name,
    String description,
    CollectionVisibility visibility,
    List<String> tags,
    List<MediaResponseDto> media,
    List<MediaListItemDto> items,
    boolean isLikedByViewer,
    long likeCount,
    ListCompletionResponseDto completion,
    List<CommentResponseDto> comments,
    long commentCount,
    List<MediaListCollaboratorResponseDto> collaborators,
    List<MediaListCollaboratorResponseDto> pendingInvites,
    boolean canEditItems,
    ListCollaboratorStatus viewerCollaboratorStatus,
    String creatorUsername,
    String creatorAvatarUrl,
    MediaListSourceDto source,
    Instant createdAt,
    Instant updatedAt) {}
