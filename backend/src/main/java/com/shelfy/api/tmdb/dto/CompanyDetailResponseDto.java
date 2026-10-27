package com.shelfy.api.tmdb.dto;

public record CompanyDetailResponseDto(
    long id, String name, String description, String headquarters, String originCountry) {}
