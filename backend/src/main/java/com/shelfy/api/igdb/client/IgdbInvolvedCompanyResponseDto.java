package com.shelfy.api.igdb.client;

public record IgdbInvolvedCompanyResponseDto(
    long id, IgdbCompanyResponseDto company, Boolean developer, Boolean publisher) {}
