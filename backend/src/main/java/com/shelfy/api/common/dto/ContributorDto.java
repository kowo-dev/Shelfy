package com.shelfy.api.common.dto;

import java.util.UUID;

public record ContributorDto(UUID userId, String username, String displayName, String avatarUrl) {}
