package com.shelfy.api.versus;

public record ClipInfo(
    ClipProvider provider,
    String externalId,
    String title,
    String author,
    String thumbnailUrl,
    Integer startSeconds) {}
