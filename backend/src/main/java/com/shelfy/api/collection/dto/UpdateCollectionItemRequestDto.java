package com.shelfy.api.collection.dto;

import com.shelfy.api.collection.UserMediaStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.util.Map;

public record UpdateCollectionItemRequestDto(
    UserMediaStatus status,
    @Min(0) @Max(10) Integer rating,
    Boolean clearRating,
    Map<String, Object> progress,
    Map<String, Object> note,
    Boolean clearNote,
    Boolean containsSpoilers,
    LocalDate completedOn) {}
