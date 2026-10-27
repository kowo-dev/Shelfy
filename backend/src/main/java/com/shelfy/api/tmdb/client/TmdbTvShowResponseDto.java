package com.shelfy.api.tmdb.client;

import java.util.List;

public record TmdbTvShowResponseDto(
    long id,
    String name,
    String originalName,
    String overview,
    String posterPath,
    String backdropPath,
    String firstAirDate,
    List<Integer> genreIds,
    List<TmdbGenreResponseDto> genres,
    List<String> originCountry,
    Double voteAverage,
    Integer voteCount,
    Integer numberOfSeasons,
    Integer numberOfEpisodes,
    List<TmdbSeasonSummaryResponseDto> seasons,
    List<TmdbCompanyResponseDto> productionCompanies,
    List<TmdbCompanyResponseDto> networks,
    TmdbCreditsResponseDto credits,
    TmdbImagesResponseDto images,
    boolean adult,
    List<TmdbCreatorResponseDto> createdBy,
    TmdbSearchResponseDto<TmdbTvShowResponseDto> recommendations,
    TmdbEpisodeResponseDto nextEpisodeToAir,
    TmdbVideosResponseDto videos) {}
