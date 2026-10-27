package com.shelfy.api.versus.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SubmitPickRequestDto(@NotNull UUID winnerEntryId) {}
