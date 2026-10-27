package com.shelfy.api.anilist.dto;

public record CharacterResponseDto(
    long characterId,
    String name,
    String imageUrl,
    String role,
    Long voiceActorId,
    String japaneseVoiceActor) {}
