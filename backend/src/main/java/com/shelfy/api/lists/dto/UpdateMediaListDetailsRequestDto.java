package com.shelfy.api.lists.dto;

import com.shelfy.api.auth.CollectionVisibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateMediaListDetailsRequestDto(
    @NotBlank @Size(max = 80) String name,
    @Size(max = 280) String description,
    @NotNull CollectionVisibility visibility,
    @Size(max = 20) List<@NotBlank @Size(max = 24) String> tags) {}
