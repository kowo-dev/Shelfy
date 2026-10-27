package com.shelfy.api.tmdb.client;

public record TmdbCompanyDetailResponseDto(
    long id,
    String name,
    String description,
    String headquarters,
    String homepage,
    String logoPath,
    String originCountry) {}
