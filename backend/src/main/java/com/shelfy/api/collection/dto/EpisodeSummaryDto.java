package com.shelfy.api.collection.dto;

public record EpisodeSummaryDto(int watched, Integer total, int lastSeason, int lastEpisode) {

  public EpisodeSummaryDto withTotal(Integer total) {
    return new EpisodeSummaryDto(watched, total, lastSeason, lastEpisode);
  }
}
