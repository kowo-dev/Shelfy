package com.shelfy.api.steam;

import com.shelfy.api.auth.oauth.OAuthProvider;
import com.shelfy.api.auth.oauth.OAuthStateService;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.steam.dto.SteamAuthorizeUrlResponseDto;
import com.shelfy.api.steam.dto.SteamImportEntryResponseDto;
import com.shelfy.api.steam.dto.SteamImportStatusResponseDto;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/v1/steam")
@RequiredArgsConstructor
public class SteamController {

  private static final String BROWSER_BINDING_COOKIE = "steam_oauth_binding";

  private final SteamService steamService;
  private final SteamImportService steamImportService;
  private final SteamProperties properties;
  private final OAuthStateService oauthStateService;

  @GetMapping("/oauth/authorize")
  public ResponseEntity<SteamAuthorizeUrlResponseDto> authorize(
      @AuthenticationPrincipal UUID userId) {
    var transaction = oauthStateService.create(OAuthProvider.STEAM, userId);
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, bindingCookie(transaction.browserToken()).toString())
        .body(
            new SteamAuthorizeUrlResponseDto(steamService.buildAuthorizeUrl(transaction.state())));
  }

  @GetMapping("/oauth/callback")
  public ResponseEntity<Void> handleCallback(
      @RequestParam Map<String, String> params,
      @CookieValue(name = BROWSER_BINDING_COOKIE, required = false) String browserToken,
      HttpServletResponse response) {
    String status = "error";
    String state = params.get("state");
    if (state != null) {
      try {
        steamService.connectAccount(params, state, browserToken);
        status = "connected";
      } catch (ApiException ex) {
        status = ex.getCode().name();
      } catch (RuntimeException ex) {
        status = "error";
      }
    }
    URI redirect =
        UriComponentsBuilder.fromUriString(properties.frontendRedirectUri())
            .queryParam("steam", status)
            .build()
            .toUri();
    response.addHeader(HttpHeaders.SET_COOKIE, expiredBindingCookie().toString());
    return ResponseEntity.status(HttpStatus.FOUND).location(redirect).build();
  }

  @DeleteMapping("/connection")
  public ResponseEntity<Void> disconnect(@AuthenticationPrincipal UUID userId) {
    steamService.disconnectAccount(userId);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/import")
  public SteamImportStatusResponseDto startImport(@AuthenticationPrincipal UUID userId) {
    return toStatusResponse(steamImportService.startImport(userId));
  }

  @GetMapping("/import/latest")
  public SteamImportStatusResponseDto getLatestImport(@AuthenticationPrincipal UUID userId) {
    return toStatusResponse(steamImportService.getLatestJob(userId));
  }

  @GetMapping("/import/{jobId}")
  public SteamImportStatusResponseDto importStatus(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID jobId) {
    return toStatusResponse(steamImportService.getJob(userId, jobId));
  }

  @GetMapping("/import/{jobId}/entries")
  public List<SteamImportEntryResponseDto> importEntries(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID jobId) {
    return steamImportService.getEntries(userId, jobId).stream()
        .map(
            entry ->
                new SteamImportEntryResponseDto(
                    entry.getSteamAppId(),
                    entry.getSteamName(),
                    entry.getStatus(),
                    entry.getReason(),
                    entry.getReasonDetail(),
                    entry.getIgdbName()))
        .toList();
  }

  private SteamImportStatusResponseDto toStatusResponse(SteamImportJobEntity job) {
    return new SteamImportStatusResponseDto(
        job.getId(),
        job.getStatus(),
        job.getEntriesTotal(),
        job.getEntriesImported(),
        job.getEntriesSkipped(),
        job.getErrorMessage());
  }

  private UUID userId(@AuthenticationPrincipal UUID userId) {
    return userId;
  }

  private ResponseCookie bindingCookie(String browserToken) {
    return ResponseCookie.from(BROWSER_BINDING_COOKIE, browserToken)
        .httpOnly(true)
        .secure(true)
        .sameSite("Lax")
        .path("/api/v1/steam/oauth")
        .maxAge(oauthStateService.ttl())
        .build();
  }

  private ResponseCookie expiredBindingCookie() {
    return ResponseCookie.from(BROWSER_BINDING_COOKIE, "")
        .httpOnly(true)
        .secure(true)
        .sameSite("Lax")
        .path("/api/v1/steam/oauth")
        .maxAge(Duration.ZERO)
        .build();
  }
}
