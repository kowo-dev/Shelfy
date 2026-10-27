package com.shelfy.api.auth.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileBannerRequestDto(
    @Size(max = 2048) @Pattern(regexp = "^https://\\S+$") String bannerUrl,
    @Size(max = 500) String title,
    @Size(max = 50) @Pattern(regexp = "^[a-z0-9_-]+$") String provider,
    @Size(max = 2048) @Pattern(regexp = "^https://\\S+$") String sourceUrl,
    @Min(0) @Max(100) Integer position) {}
