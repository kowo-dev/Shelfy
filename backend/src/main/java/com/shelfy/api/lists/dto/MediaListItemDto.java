package com.shelfy.api.lists.dto;

import com.shelfy.api.common.dto.ContributorDto;
import java.util.UUID;

public record MediaListItemDto(UUID mediaId, ContributorDto addedBy) {}
