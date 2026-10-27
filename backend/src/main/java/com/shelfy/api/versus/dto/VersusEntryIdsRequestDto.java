package com.shelfy.api.versus.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record VersusEntryIdsRequestDto(@NotEmpty @Size(max = 200) List<@NotNull UUID> entryIds) {}
