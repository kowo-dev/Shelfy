package com.shelfy.api.versus.dto;

import jakarta.validation.constraints.Size;

public record DuplicateVersusPoolRequestDto(@Size(max = 80) String name) {}
