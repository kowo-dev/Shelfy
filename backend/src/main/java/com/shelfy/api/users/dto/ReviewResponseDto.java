package com.shelfy.api.users.dto;

import com.shelfy.api.collection.dto.MediaResponseDto;
import com.shelfy.api.comments.dto.CommentResponseDto;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ReviewResponseDto(
    UUID id,
    UUID userId,
    String username,
    String displayName,
    String avatarUrl,
    MediaResponseDto media,
    Integer rating,
    Map<String, Object> content,
    boolean containsSpoilers,
    boolean isLikedByViewer,
    long likeCount,
    List<CommentResponseDto> comments,
    long commentCount,
    Instant createdAt,
    Instant updatedAt) {}
