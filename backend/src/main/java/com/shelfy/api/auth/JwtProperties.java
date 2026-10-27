package com.shelfy.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "app.jwt")
@Validated
public record JwtProperties(
    @NotBlank @Size(min = 32) String accessTokenSecret,
    @NotBlank String issuer,
    @NotBlank String audience,
    @Positive long accessTokenExpirationMinutes,
    @Positive long refreshTokenExpirationDays) {}
