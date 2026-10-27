package com.shelfy.api.steam;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.auth.oauth.OAuthProvider;
import com.shelfy.api.auth.oauth.OAuthStateService;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.steam.client.SteamClient;
import com.shelfy.api.steam.client.SteamPlayerSummaryResponseDto;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

@Service
@RequiredArgsConstructor
public class SteamService {

  private static final String OPENID_NS = "http://specs.openid.net/auth/2.0";
  private static final String OPENID_IDENTIFIER_SELECT =
      "http://specs.openid.net/auth/2.0/identifier_select";

  private final SteamClient steamClient;
  private final SteamProperties properties;
  private final OAuthStateService stateService;
  private final UserRepository userRepository;

  public String buildAuthorizeUrl(String state) {
    String returnTo =
        UriComponentsBuilder.fromUriString(properties.callbackUrl())
            .queryParam("state", state)
            .build()
            .toUriString();
    return UriComponentsBuilder.fromUriString(properties.authorizeUrl())
        .queryParam("openid.ns", OPENID_NS)
        .queryParam("openid.mode", "checkid_setup")
        .queryParam("openid.return_to", returnTo)
        .queryParam("openid.realm", realm())
        .queryParam("openid.identity", OPENID_IDENTIFIER_SELECT)
        .queryParam("openid.claimed_id", OPENID_IDENTIFIER_SELECT)
        .build()
        .toUriString();
  }

  @Transactional
  public void connectAccount(Map<String, String> openidParams, String state, String browserToken) {
    if (!expectedReturnTo(state).equals(openidParams.get("openid.return_to"))) {
      throw invalidState();
    }
    UUID userId =
        stateService
            .consume(OAuthProvider.STEAM, state, browserToken)
            .orElseThrow(this::invalidState);
    UserEntity user = getUser(userId);

    if (!steamClient.verifyOpenId(openidParams)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.STEAM_PROVIDER_UNAVAILABLE,
          "Steam OpenID verification failed");
    }

    String claimedId = openidParams.getOrDefault("openid.claimed_id", "");
    String steamId = claimedId.substring(claimedId.lastIndexOf('/') + 1);
    if (steamId.isBlank() || !steamId.chars().allMatch(Character::isDigit)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, ErrorCode.STEAM_PROVIDER_UNAVAILABLE, "Invalid Steam ID");
    }

    userRepository
        .findBySteamId(steamId)
        .filter(existing -> !existing.getId().equals(userId))
        .ifPresent(
            existing -> {
              throw new ConflictException(
                  ErrorCode.STEAM_ALREADY_LINKED,
                  "This Steam account is already linked to another Shelfy account");
            });

    SteamPlayerSummaryResponseDto summary = steamClient.fetchPlayerSummary(steamId);

    user.setSteamId(steamId);
    user.setSteamDisplayName(summary != null ? summary.personaName() : steamId);
    user.setSteamAvatarUrl(summary != null ? summary.avatarFull() : null);
    user.setSteamConnectedAt(Instant.now());
    userRepository.save(user);
  }

  @Transactional
  public void disconnectAccount(UUID userId) {
    UserEntity user = getUser(userId);
    user.setSteamId(null);
    user.setSteamDisplayName(null);
    user.setSteamAvatarUrl(null);
    user.setSteamConnectedAt(null);
    userRepository.save(user);
  }

  private String realm() {
    URI uri = URI.create(properties.callbackUrl());
    return uri.getScheme() + "://" + uri.getAuthority();
  }

  private String expectedReturnTo(String state) {
    return UriComponentsBuilder.fromUriString(properties.callbackUrl())
        .queryParam("state", state)
        .build()
        .toUriString();
  }

  private ApiException invalidState() {
    return new ApiException(
        HttpStatus.BAD_REQUEST, ErrorCode.STEAM_OAUTH_STATE_INVALID, "Invalid Steam OAuth state");
  }

  private UserEntity getUser(UUID userId) {
    return userRepository
        .findById(userId)
        .orElseThrow(
            () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
  }
}
