package com.shelfy.api.tmdb.dto;

import java.time.LocalDate;
import java.util.List;

public record MovieDetailResponseDto(
    long id,
    String title,
    String originalTitle,
    String overview,
    String posterPath,
    String backdropPath,
    LocalDate releaseDate,
    Integer runtime,
    List<TmdbGenreDto> genres,
    double voteAverage,
    int voteCount,
    boolean isAdult,
    Long budget,
    Long revenue,
    List<CompanyRefDto> productionCompanies,
    PersonRefDto director,
    List<String> backdropImagePaths,
    List<String> posterImagePaths,
    List<CastMemberResponseDto> cast,
    String trailerUrl) {}
