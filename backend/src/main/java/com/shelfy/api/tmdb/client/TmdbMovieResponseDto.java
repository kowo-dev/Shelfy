package com.shelfy.api.tmdb.client;

import java.util.List;

public record TmdbMovieResponseDto(
    long id,
    String title,
    String originalTitle,
    String overview,
    String posterPath,
    String backdropPath,
    String releaseDate,
    List<Integer> genreIds,
    List<TmdbGenreResponseDto> genres,
    Double voteAverage,
    Integer voteCount,
    boolean adult,
    Integer runtime,
    Long budget,
    Long revenue,
    List<TmdbCompanyResponseDto> productionCompanies,
    TmdbCreditsResponseDto credits,
    TmdbImagesResponseDto images,
    TmdbCollectionRefResponseDto belongsToCollection,
    TmdbSearchResponseDto<TmdbMovieResponseDto> recommendations,
    TmdbVideosResponseDto videos) {}
