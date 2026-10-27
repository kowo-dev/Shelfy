package com.shelfy.api.versus.dto;

import com.shelfy.api.auth.CollectionVisibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateVersusPoolRequestDto(
    @NotBlank @Size(max = 80) String name,
    @Size(max = 280) String description,
    @NotNull CollectionVisibility visibility) {}
