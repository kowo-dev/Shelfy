package com.shelfy.api.people.dto;

import com.shelfy.api.auth.CollectionVisibility;
import java.util.List;
import java.util.UUID;

public record UserSearchResultResponseDto(
    UUID id,
    String username,
    String displayName,
    String avatarUrl,
    CollectionVisibility profileVisibility,
    boolean isFollowedByCurrentUser,
    String bannerUrl,
    Long titleCount,
    List<String> coverUrls,
    Long followersCount) {}
