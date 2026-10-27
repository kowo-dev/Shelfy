package com.shelfy.api.notifications.dto;

import java.util.UUID;

public record NotificationActorDto(
    UUID id, String username, String displayName, String avatarUrl, String domain) {}
