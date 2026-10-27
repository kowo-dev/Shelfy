package com.shelfy.api.versus.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResolveVersusClipRequestDto(@NotBlank @Size(max = 2048) String url) {}
