package com.shelfy.api.tmdb.dto;

import java.time.LocalDate;
import java.util.List;

public record PersonDetailResponseDto(
    long id,
    String name,
    String biography,
    String profilePath,
    LocalDate birthday,
    LocalDate deathday,
    String placeOfBirth,
    List<PersonCreditResponseDto> credits) {}
