package com.shelfy.api.common.dto;

import com.shelfy.api.auth.CollectionVisibility;
import java.util.List;
import java.util.UUID;

public record EditableCreationResponseDto(
    UUID id,
    String name,
    CollectionVisibility visibility,
    int itemCount,
    List<String> covers,
    boolean isOwner,
    boolean hasClips,
    UUID containedId) {}
