package com.shelfy.api.versus.dto;

import java.util.UUID;

public record VersusMatchResponseDto(
    UUID id,
    int round,
    int slotIndex,
    VersusEntryResponseDto entryA,
    VersusEntryResponseDto entryB,
    UUID winnerEntryId,
    boolean isDecided) {}
