package com.shelfy.api.auth;

import com.shelfy.api.auth.dto.UserResponseDto;
import com.shelfy.api.federation.FederationProperties;
import com.shelfy.api.steam.SteamProperties;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class UserResponseMapper {

  private final EmailChangeTokenRepository emailChangeTokenRepository;
  private final AvatarStorageService avatarStorageService;
  private final boolean steamAvailable;
  private final FederationProperties federationProperties;
  private final boolean emailVerificationRequired;

  public UserResponseMapper(
      EmailChangeTokenRepository emailChangeTokenRepository,
      AvatarStorageService avatarStorageService,
      SteamProperties steamProperties,
      FederationProperties federationProperties,
      EmailVerificationProperties emailVerificationProperties) {
    this.emailChangeTokenRepository = emailChangeTokenRepository;
    this.avatarStorageService = avatarStorageService;
    this.steamAvailable = steamProperties.apiKey() != null && !steamProperties.apiKey().isBlank();
    this.federationProperties = federationProperties;
    this.emailVerificationRequired = emailVerificationProperties.required();
  }

  public UserResponseDto toResponse(UserEntity user) {
    String pendingEmail =
        emailChangeTokenRepository
            .findFirstByUser_IdAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                user.getId(), Instant.now())
            .map(EmailChangeTokenEntity::getNewEmail)
            .orElse(null);
    return new UserResponseDto(
        user.getId(),
        user.getEmail(),
        pendingEmail,
        user.getUsername(),
        user.getDisplayName(),
        user.getBio(),
        avatarStorageService.urlFor(user.getAvatarFilename()),
        user.getProfileBannerUrl(),
        user.getProfileBannerTitle(),
        user.getProfileBannerProvider(),
        user.getProfileBannerSourceUrl(),
        user.getProfileBannerPosition(),
        user.getProfileVisibility(),
        user.isFederationOptOut(),
        user.isAdultContentAllowed(),
        user.getAdultContentConfirmedAt() != null,
        user.isEmailVerified() || !emailVerificationRequired,
        user.getSteamId() != null,
        user.getSteamDisplayName(),
        steamAvailable,
        federationProperties.isAdmin(
            user.getEmail(), user.isEmailVerified(), user.getDomain() == null),
        user.getCreatedAt());
  }
}
