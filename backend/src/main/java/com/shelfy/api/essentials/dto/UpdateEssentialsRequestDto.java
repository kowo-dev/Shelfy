package com.shelfy.api.essentials.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record UpdateEssentialsRequestDto(
    @NotNull @Size(max = 5) List<@NotNull UUID> userMediaIds) {}
