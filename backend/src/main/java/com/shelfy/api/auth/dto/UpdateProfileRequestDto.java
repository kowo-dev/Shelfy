package com.shelfy.api.auth.dto;

import com.shelfy.api.auth.CollectionVisibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequestDto(
    @NotBlank
        @Size(min = 3, max = 50)
        @Pattern(
            regexp = "^[A-Za-z0-9_.-]+$",
            message = "Username can only contain letters, numbers, dots, dashes and underscores")
        String username,
    @Size(max = 50)
        @Pattern(regexp = "^[^<>{}\\r\\n]*$", message = "Display name contains invalid characters")
        String displayName,
    @Size(max = 500) @Pattern(regexp = "^[^<>{}]*$", message = "Bio contains invalid characters")
        String bio,
    CollectionVisibility profileVisibility,
    Boolean isAdultContentAllowed,
    boolean confirmAdultContent,
    Boolean hasOptedOutOfFederation) {}
