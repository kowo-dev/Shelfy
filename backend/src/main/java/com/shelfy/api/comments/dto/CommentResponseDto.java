package com.shelfy.api.comments.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CommentResponseDto(
    UUID id,
    UUID authorId,
    String authorUsername,
    String authorAvatarUrl,
    String content,
    Instant createdAt,
    Instant updatedAt,
    int upvotes,
    int downvotes,
    Integer myVote,
    UUID parentCommentId,
    boolean isDeleted,
    List<CommentResponseDto> replies) {}
