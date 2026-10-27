package com.shelfy.api.collection.dto;

import com.shelfy.api.collection.UserMediaStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record BulkUpdateCollectionItemRequestDto(
    @NotEmpty @Size(max = 500) List<UUID> ids,
    UserMediaStatus status,
    @Min(0) @Max(10) Integer rating,
    Boolean clearRating) {}
