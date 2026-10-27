package com.shelfy.api.lists.dto;

public record ListCompletionResponseDto(
    int total,
    int inCollection,
    int planned,
    int ongoing,
    int done,
    int dropped,
    int completed,
    int percentage) {}
