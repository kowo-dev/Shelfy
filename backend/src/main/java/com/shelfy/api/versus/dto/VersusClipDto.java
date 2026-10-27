package com.shelfy.api.versus.dto;

public record VersusClipDto(
    String provider, String externalId, String title, String author, Integer startSeconds) {}
