package com.shelfy.api.collection.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record LookupBatchRequestDto(
    @NotEmpty @Size(max = 200) @Valid List<MediaReferenceDto> references) {}
