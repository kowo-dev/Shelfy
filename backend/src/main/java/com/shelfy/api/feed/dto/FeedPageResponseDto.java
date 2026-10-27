package com.shelfy.api.feed.dto;

import java.time.Instant;
import java.util.List;

public record FeedPageResponseDto(List<FeedItemDto> items, Instant nextBefore) {}
