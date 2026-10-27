package com.shelfy.api.auth.dto;

import com.shelfy.api.auth.CollectionVisibility;
import java.time.Instant;
import java.util.UUID;

public record UserResponseDto(
    UUID id,
    String email,
    String pendingEmail,
    String username,
    String displayName,
    String bio,
    String avatarUrl,
    String profileBannerUrl,
    String profileBannerTitle,
    String profileBannerProvider,
    String profileBannerSourceUrl,
    Integer profileBannerPosition,
    CollectionVisibility profileVisibility,
    boolean hasOptedOutOfFederation,
    boolean isAdultContentAllowed,
    boolean hasConfirmedAdultContent,
    boolean isEmailVerified,
    boolean isSteamConnected,
    String steamDisplayName,
    boolean isSteamAvailable,
    boolean isAdmin,
    Instant createdAt) {}
