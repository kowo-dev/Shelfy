package com.shelfy.api.steam.dto;

import com.shelfy.api.common.ImportEntryStatus;

public record SteamImportEntryResponseDto(
    long steamAppId,
    String steamName,
    ImportEntryStatus status,
    String reason,
    String reasonDetail,
    String igdbName) {}
