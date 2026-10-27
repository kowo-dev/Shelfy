package com.shelfy.api.follows.dto;

import java.util.List;
import java.util.UUID;

public record FollowUserResponseDto(
    UUID id,
    String username,
    String displayName,
    String avatarUrl,
    String bannerUrl,
    Long titleCount,
    List<String> coverUrls,
    Long followersCount,
    boolean isFavorite) {}
