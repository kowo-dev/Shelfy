package com.shelfy.api.collection.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Map;

public record UpsertWatchLogRequestDto(
    @NotNull LocalDate occurredAt,
    boolean isRewatch,
    @Size(max = 120) String name,
    @Min(0) @Max(10) Integer rating,
    Map<String, Object> review,
    boolean containsSpoilers) {}
