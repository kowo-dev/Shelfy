package com.shelfy.api.tmdb.dto;

import java.time.LocalDate;
import java.util.List;

public record TvShowDetailResponseDto(
    long id,
    String name,
    String originalName,
    String overview,
    String posterPath,
    String backdropPath,
    LocalDate firstAirDate,
    Integer numberOfSeasons,
    Integer numberOfEpisodes,
    List<SeasonSummaryResponseDto> seasons,
    List<TmdbGenreDto> genres,
    double voteAverage,
    int voteCount,
    List<CompanyRefDto> productionCompanies,
    List<CompanyRefDto> networks,
    List<String> backdropImagePaths,
    List<String> posterImagePaths,
    List<CastMemberResponseDto> cast,
    boolean isAdult,
    String trailerUrl) {}
