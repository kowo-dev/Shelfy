package com.shelfy.api.comments.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CommentVoteRequestDto(@NotNull @Min(-1) @Max(1) Integer value) {}
