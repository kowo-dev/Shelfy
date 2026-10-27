package com.shelfy.api.letterboxd.dto;

import com.shelfy.api.common.ImportStatus;
import java.util.UUID;

public record LetterboxdImportStatusResponseDto(
    UUID jobId,
    ImportStatus status,
    int entriesTotal,
    int entriesImported,
    int entriesSkipped,
    String errorMessage) {}
