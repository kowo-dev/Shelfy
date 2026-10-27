package com.shelfy.api.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record DeleteAccountRequestDto(@NotBlank String password) {}
