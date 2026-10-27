package com.shelfy.api.follows.dto;

import java.util.List;
import java.util.UUID;

public record PopularUserResponseDto(
    UUID id,
    String username,
    String displayName,
    String avatarUrl,
    long followersCount,
    String bannerUrl,
    Long titleCount,
    List<String> coverUrls) {}
