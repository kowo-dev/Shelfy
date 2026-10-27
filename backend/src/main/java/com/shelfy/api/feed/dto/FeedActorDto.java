package com.shelfy.api.feed.dto;

import java.util.UUID;

public record FeedActorDto(UUID id, String username, String displayName, String avatarUrl) {}
