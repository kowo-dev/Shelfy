package com.shelfy.api.igdb.dto;

public record CompanyDetailResponseDto(
    long id, String name, String description, String logoImageId, String websiteUrl) {}
