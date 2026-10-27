package com.shelfy.api.versus.dto;

import com.shelfy.api.collection.dto.MediaReferenceDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AddVersusItemsRequestDto(
    @NotNull @Size(max = 200) List<@Valid MediaReferenceDto> items) {}
