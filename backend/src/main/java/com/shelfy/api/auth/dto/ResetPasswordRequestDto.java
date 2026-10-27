package com.shelfy.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequestDto(
    @NotBlank String token, @NotBlank @Size(min = 12) @MaxBytes(72) String newPassword) {}
