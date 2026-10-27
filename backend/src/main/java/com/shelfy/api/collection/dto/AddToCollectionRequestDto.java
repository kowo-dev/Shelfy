package com.shelfy.api.collection.dto;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.UserMediaStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Map;

public record AddToCollectionRequestDto(
    @NotBlank @Size(max = 255) String externalId,
    @NotBlank @Size(max = 50) String provider,
    @NotNull MediaType mediaType,
    @NotNull UserMediaStatus status,
    @Min(0) @Max(10) Integer rating,
    Map<String, Object> progress,
    LocalDate completedOn) {}
