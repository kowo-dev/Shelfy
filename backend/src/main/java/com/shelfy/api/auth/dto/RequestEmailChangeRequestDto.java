package com.shelfy.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record RequestEmailChangeRequestDto(@NotBlank @Email String newEmail) {}
