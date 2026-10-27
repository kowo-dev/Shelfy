package com.shelfy.api.users.dto;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.collection.dto.CollectionItemResponseDto;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record UserProfileResponseDto(
    UUID id,
    String username,
    String displayName,
    String bio,
    String avatarUrl,
    String profileBannerUrl,
    String profileBannerTitle,
    String profileBannerProvider,
    String profileBannerSourceUrl,
    Integer profileBannerPosition,
    CollectionVisibility profileVisibility,
    boolean isFollowedByCurrentUser,
    Instant createdAt,
    ProfileStats stats,
    List<CollectionItemResponseDto> ongoingItems) {

  public record ProfileStats(
      long totalItems,
      long doneCount,
      Double averageRating,
      long followersCount,
      long reviewsCount) {}
}
