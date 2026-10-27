package com.shelfy.api.collection.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record BulkDeleteRequestDto(@NotEmpty @Size(max = 500) List<UUID> ids) {}
