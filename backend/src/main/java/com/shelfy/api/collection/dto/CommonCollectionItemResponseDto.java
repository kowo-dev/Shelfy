package com.shelfy.api.collection.dto;

public record CommonCollectionItemResponseDto(
    PublicCollectionItemResponseDto theirs, CollectionItemResponseDto mine) {}
