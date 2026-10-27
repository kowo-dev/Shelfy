package com.shelfy.api.lists.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record InviteCollaboratorRequestDto(@NotNull UUID userId) {}
