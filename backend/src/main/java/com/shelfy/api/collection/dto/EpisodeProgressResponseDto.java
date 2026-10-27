package com.shelfy.api.collection.dto;

import com.shelfy.api.collection.UserMediaStatus;
import java.util.List;
import java.util.Map;

public record EpisodeProgressResponseDto(
    List<SeasonProgressDto> seasons, boolean isCompleted, UserMediaStatus status) {

  public record SeasonProgressDto(
      int season, Integer total, List<Integer> watched, Map<Integer, Integer> ratings) {}
}
