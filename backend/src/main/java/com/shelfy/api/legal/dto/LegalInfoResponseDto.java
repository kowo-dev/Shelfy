package com.shelfy.api.legal.dto;

public record LegalInfoResponseDto(
    String controllerName,
    String contactEmail,
    String jurisdiction,
    String hostingProviderName,
    String hostingProviderAddress,
    boolean isFederationEnabled,
    boolean isRegistrationOpen) {}
