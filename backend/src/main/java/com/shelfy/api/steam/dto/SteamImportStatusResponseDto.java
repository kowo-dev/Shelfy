package com.shelfy.api.steam.dto;

import com.shelfy.api.common.ImportStatus;
import java.util.UUID;

public record SteamImportStatusResponseDto(
    UUID jobId,
    ImportStatus status,
    int gamesTotal,
    int gamesImported,
    int gamesSkipped,
    String errorMessage) {}
