package com.shelfy.api.search.dto;

import com.shelfy.api.collection.MediaType;
import java.util.List;

public record SearchResultResponseDto(
    String provider,
    MediaType mediaType,
    String externalId,
    String title,
    String posterPath,
    String overview,
    Integer releaseYear,
    List<String> genres,
    Double voteAverage,
    Integer voteCount,
    String status,
    boolean isInCollection,
    String backdropPath) {

  public SearchResultResponseDto(
      String provider,
      MediaType mediaType,
      String externalId,
      String title,
      String posterPath,
      String overview,
      Integer releaseYear,
      List<String> genres,
      Double voteAverage,
      Integer voteCount,
      String status,
      boolean inCollection) {
    this(
        provider,
        mediaType,
        externalId,
        title,
        posterPath,
        overview,
        releaseYear,
        genres,
        voteAverage,
        voteCount,
        status,
        inCollection,
        null);
  }

  public SearchResultResponseDto asInCollection() {
    return new SearchResultResponseDto(
        provider,
        mediaType,
        externalId,
        title,
        posterPath,
        overview,
        releaseYear,
        genres,
        voteAverage,
        voteCount,
        status,
        true,
        backdropPath);
  }
}
