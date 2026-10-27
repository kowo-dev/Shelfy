package com.shelfy.api.common.dto;

import java.time.Instant;
import java.time.LocalDate;

public record NextAiringDto(
    Integer season,
    Integer episode,
    String title,
    LocalDate airDate,
    Instant airingAt,
    String stillPath) {

  public static final NextAiringDto NONE = new NextAiringDto(null, null, null, null, null, null);

  public boolean scheduled() {
    return episode != null && airDate != null;
  }
}
