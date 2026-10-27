package com.shelfy.api.auth;

import com.shelfy.api.auth.dto.AuthResponseDto;
import com.shelfy.api.auth.dto.ConfirmEmailChangeRequestDto;
import com.shelfy.api.auth.dto.ForgotPasswordRequestDto;
import com.shelfy.api.auth.dto.LoginRequestDto;
import com.shelfy.api.auth.dto.RegisterRequestDto;
import com.shelfy.api.auth.dto.ResendVerificationRequestDto;
import com.shelfy.api.auth.dto.ResetPasswordRequestDto;
import com.shelfy.api.auth.dto.UserResponseDto;
import com.shelfy.api.auth.dto.VerifyEmailRequestDto;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

  private static final String REFRESH_TOKEN_COOKIE = "refresh_token";

  private final AuthService authService;
  private final JwtProperties jwtProperties;

  @PostMapping("/register")
  public ResponseEntity<UserResponseDto> register(@Valid @RequestBody RegisterRequestDto request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
  }

  @PostMapping("/login")
  public ResponseEntity<AuthResponseDto> login(@Valid @RequestBody LoginRequestDto request) {
    AuthService.AuthResult result = authService.login(request);
    ResponseCookie cookie = buildRefreshTokenCookie(result.rawRefreshToken());
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, cookie.toString())
        .body(result.authResponse());
  }

  @PostMapping("/refresh")
  public ResponseEntity<AuthResponseDto> refresh(
      @CookieValue(name = REFRESH_TOKEN_COOKIE, required = true) String refreshToken) {
    AuthService.AuthResult result = authService.refresh(refreshToken);
    if (result.rawRefreshToken() == null) {
      return ResponseEntity.ok(result.authResponse());
    }
    ResponseCookie cookie = buildRefreshTokenCookie(result.rawRefreshToken());
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, cookie.toString())
        .body(result.authResponse());
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      @CookieValue(name = REFRESH_TOKEN_COOKIE, required = false) String refreshToken,
      HttpServletResponse response) {
    if (refreshToken != null) {
      authService.logout(refreshToken);
    }
    ResponseCookie expiredCookie = buildExpiredRefreshTokenCookie();
    response.addHeader(HttpHeaders.SET_COOKIE, expiredCookie.toString());
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/verify-email")
  public ResponseEntity<Void> verifyEmail(@Valid @RequestBody VerifyEmailRequestDto request) {
    authService.verifyEmail(request.token());
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/resend-verification")
  public ResponseEntity<Void> resendVerification(
      @Valid @RequestBody ResendVerificationRequestDto request) {
    authService.resendVerificationEmail(request.email());
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/confirm-email-change")
  public ResponseEntity<UserResponseDto> confirmEmailChange(
      @Valid @RequestBody ConfirmEmailChangeRequestDto request) {
    return ResponseEntity.ok(authService.confirmEmailChange(request.token()));
  }

  @PostMapping("/forgot-password")
  public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequestDto request) {
    authService.forgotPassword(request.email());
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/reset-password")
  public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequestDto request) {
    authService.resetPassword(request.token(), request.newPassword());
    return ResponseEntity.noContent().build();
  }

  private ResponseCookie buildRefreshTokenCookie(String rawRefreshToken) {
    return ResponseCookie.from(REFRESH_TOKEN_COOKIE, rawRefreshToken)
        .httpOnly(true)
        .secure(true)
        .sameSite("Lax")
        .path("/api/v1/auth")
        .maxAge(Duration.ofDays(jwtProperties.refreshTokenExpirationDays()))
        .build();
  }

  private ResponseCookie buildExpiredRefreshTokenCookie() {
    return ResponseCookie.from(REFRESH_TOKEN_COOKIE, "")
        .httpOnly(true)
        .secure(true)
        .sameSite("Lax")
        .path("/api/v1/auth")
        .maxAge(0)
        .build();
  }
}
