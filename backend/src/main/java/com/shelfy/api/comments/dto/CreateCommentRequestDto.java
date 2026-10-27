package com.shelfy.api.comments.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateCommentRequestDto(
    @NotBlank @Size(max = 500) String content, UUID parentCommentId) {}
