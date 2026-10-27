package com.shelfy.api.lists.dto;

import com.shelfy.api.collection.dto.MediaReferenceDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AddMediaListItemsRequestDto(
    @NotEmpty @Size(max = 200) List<@Valid MediaReferenceDto> media) {}
