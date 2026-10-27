package com.shelfy.api.collection.dto;

import com.shelfy.api.collection.MediaType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MediaReferenceDto(
    @NotBlank @Size(max = 50) String provider,
    @NotNull MediaType mediaType,
    @NotBlank @Size(max = 255) String externalId) {}
