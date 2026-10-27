package com.shelfy.api.users.dto;

import com.shelfy.api.collection.dto.MediaResponseDto;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record UserActivityResponseDto(
    UUID id, String type, MediaResponseDto media, Map<String, Object> payload, Instant createdAt) {}
