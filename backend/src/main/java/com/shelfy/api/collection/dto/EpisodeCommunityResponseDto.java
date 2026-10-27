package com.shelfy.api.collection.dto;

import java.util.List;

public record EpisodeCommunityResponseDto(
    List<EpisodeAverageDto> averages, List<FollowedEpisodeRatingsDto> following) {

  public record EpisodeAverageDto(int season, int episode, double average, long votes) {}

  public record FollowedEpisodeRatingsDto(
      String username, String displayName, String avatarUrl, List<EpisodeRatingDto> ratings) {}

  public record EpisodeRatingDto(int season, int episode, int rating) {}
}
