package com.shelfy.api.versus.dto;

import com.shelfy.api.collection.dto.MediaReferenceDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record UpdateVersusClipRequestDto(
    @Min(0) @Max(86_400) Integer startSeconds, @Valid MediaReferenceDto linkedMedia) {}
