package com.shelfy.api.letterboxd.dto;

import com.shelfy.api.common.ImportEntryStatus;

public record LetterboxdImportEntryResponseDto(
    String letterboxdTitle,
    Integer letterboxdYear,
    ImportEntryStatus status,
    String reason,
    String reasonDetail) {}
