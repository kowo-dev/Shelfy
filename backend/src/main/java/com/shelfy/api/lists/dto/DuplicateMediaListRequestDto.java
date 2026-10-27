package com.shelfy.api.lists.dto;

import jakarta.validation.constraints.Size;

public record DuplicateMediaListRequestDto(@Size(max = 80) String name) {}
