package com.shelfy.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequestDto(
    @NotBlank @Email String email,
    @NotBlank
        @Size(min = 3, max = 50)
        @Pattern(
            regexp = "^[A-Za-z0-9_.-]+$",
            message = "Username can only contain letters, numbers, dots, dashes and underscores")
        String username,
    @NotBlank @Size(min = 12) @MaxBytes(72) String password) {}
