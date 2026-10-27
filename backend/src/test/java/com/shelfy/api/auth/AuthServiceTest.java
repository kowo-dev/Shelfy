package com.shelfy.api.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.shelfy.api.auth.dto.LoginRequestDto;
import com.shelfy.api.auth.dto.RegisterRequestDto;
import com.shelfy.api.auth.dto.UserResponseDto;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.mail.MailService;
import com.shelfy.api.federation.FederationProperties;
import com.shelfy.api.federation.ProfilePublisher;
import com.shelfy.api.steam.SteamProperties;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {

  private final UserRepository userRepository = mock(UserRepository.class);
  private final RefreshTokenRepository refreshTokenRepository = mock(RefreshTokenRepository.class);
  private final PasswordResetTokenRepository passwordResetTokenRepository =
      mock(PasswordResetTokenRepository.class);
  private final EmailVerificationTokenRepository emailVerificationTokenRepository =
      mock(EmailVerificationTokenRepository.class);
  private final EmailChangeTokenRepository emailChangeTokenRepository =
      mock(EmailChangeTokenRepository.class);
  private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
  private final JwtService jwtService = mock(JwtService.class);
  private final MailService mailService = mock(MailService.class);
  private final AvatarStorageService avatarStorageService = mock(AvatarStorageService.class);
  private final AuthService authService = authService(true);

  private AuthService authService(boolean emailVerificationRequired) {
    return authService(emailVerificationRequired, true);
  }

  private AuthService authService(boolean emailVerificationRequired, boolean registrationOpen) {
    EmailVerificationProperties emailVerification =
        new EmailVerificationProperties(
            1_440, "https://shelfy.example/auth/verify-email", emailVerificationRequired);
    return new AuthService(
        userRepository,
        refreshTokenRepository,
        passwordResetTokenRepository,
        emailVerificationTokenRepository,
        emailChangeTokenRepository,
        passwordEncoder,
        jwtService,
        new JwtProperties("a".repeat(32), "shelfy-api", "shelfy-web", 15, 7),
        mailService,
        avatarStorageService,
        new PasswordResetProperties(30, "https://shelfy.example/auth/reset-password"),
        emailVerification,
        new EmailChangeProperties(30, "https://shelfy.example/confirm-email-change"),
        new RegistrationProperties(registrationOpen),
        new UserResponseMapper(
            emailChangeTokenRepository,
            avatarStorageService,
            new SteamProperties(null, null, null, null, null, null),
            new FederationProperties(
                false, null, null, null, false, List.of("admin@example.com"), false),
            emailVerification),
        mock(ProfilePublisher.class));
  }

  @Test
  void register_withVerificationRequired_createsAnUnverifiedUserAndAToken() {
    when(userRepository.save(any(UserEntity.class))).thenAnswer(call -> call.getArgument(0));

    UserResponseDto created =
        authService.register(new RegisterRequestDto("person@example.com", "person", "password"));

    assertFalse(created.isEmailVerified());
    verify(emailVerificationTokenRepository).save(any(EmailVerificationTokenEntity.class));
  }

  @Test
  void register_withoutVerificationRequired_createsAVerifiedUserAndSendsNoEmail() {
    when(userRepository.save(any(UserEntity.class))).thenAnswer(call -> call.getArgument(0));

    UserResponseDto created =
        authService(false)
            .register(new RegisterRequestDto("person@example.com", "person", "password"));

    assertTrue(created.isEmailVerified());
    verify(emailVerificationTokenRepository, never()).save(any());
    verify(mailService, never()).send(any(), any(), any());
  }

  @Test
  void register_withoutVerificationRequired_withAnAdminEmail_grantsNoAdminRights() {
    ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
    when(userRepository.save(saved.capture())).thenAnswer(call -> call.getArgument(0));

    UserResponseDto created =
        authService(false)
            .register(new RegisterRequestDto("admin@example.com", "squatter", "password"));

    assertFalse(saved.getValue().isEmailVerified());
    assertFalse(created.isAdmin());
  }

  @Test
  void login_withoutVerificationRequired_acceptsAnUnconfirmedEmail() {
    UserEntity user = user();
    user.setEmailVerified(false);
    when(userRepository.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));
    when(passwordEncoder.matches("password", user.getPasswordHash())).thenReturn(true);
    when(jwtService.generateAccessToken(user)).thenReturn("access");

    AuthService.AuthResult result =
        authService(false).login(new LoginRequestDto(user.getEmail(), "password"));

    assertEquals("access", result.authResponse().accessToken());
  }

  @Test
  void register_withRegistrationsClosed_createsNoAccount() {
    ForbiddenException error =
        assertThrows(
            ForbiddenException.class,
            () ->
                authService(true, false)
                    .register(new RegisterRequestDto("person@example.com", "person", "password")));

    assertEquals(ErrorCode.REGISTRATION_CLOSED, error.getCode());
    verify(userRepository, never()).save(any());
  }

  @Test
  void forgotPassword_sendsTokenInUrlFragment() {
    UserEntity user = user();
    when(userRepository.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));

    authService.forgotPassword(user.getEmail());

    ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
    verify(mailService).send(eq(user.getEmail()), any(), body.capture());
    assertTrue(body.getValue().contains("/auth/reset-password#token="));
    assertFalse(body.getValue().contains("/auth/reset-password?token="));
  }

  @Test
  void resendVerificationEmail_sendsTokenInUrlFragment() {
    UserEntity user = user();
    when(userRepository.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));

    authService.resendVerificationEmail(user.getEmail());

    ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
    verify(mailService).send(eq(user.getEmail()), any(), body.capture());
    assertTrue(body.getValue().contains("/auth/verify-email#token="));
    assertFalse(body.getValue().contains("/auth/verify-email?token="));
  }

  @Test
  void login_unknownEmail_runsPasswordComparisonBeforeRejecting() {
    when(userRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

    assertThrows(
        BadCredentialsException.class,
        () -> authService.login(new LoginRequestDto("missing@example.com", "any-password")));

    ArgumentCaptor<String> hash = ArgumentCaptor.forClass(String.class);
    verify(passwordEncoder).matches(eq("any-password"), hash.capture());
    assertTrue(hash.getValue().startsWith("$2a$10$"));
  }

  @Test
  void mailFailure_logsUserIdWithoutEmailAddress() {
    UserEntity user = user();
    when(userRepository.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));
    doThrow(new IllegalStateException("SMTP unavailable"))
        .when(mailService)
        .send(eq(user.getEmail()), any(), any());
    Logger logger = (Logger) LoggerFactory.getLogger(AuthService.class);
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);

    try {
      authService.forgotPassword(user.getEmail());

      assertTrue(
          appender.list.stream()
              .anyMatch(event -> event.getFormattedMessage().contains(user.getId().toString())));
      assertFalse(
          appender.list.stream()
              .anyMatch(event -> event.getFormattedMessage().contains(user.getEmail())));
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  @Test
  void refresh_withTokenReplacedMomentsAgo_returnsAccessTokenOnlyAndKeepsTheFamily() {
    RefreshTokenEntity token = replacedToken(Instant.now().minusSeconds(3));
    when(refreshTokenRepository.findByTokenHashForUpdate(any())).thenReturn(Optional.of(token));
    when(jwtService.generateAccessToken(token.getUser())).thenReturn("access");

    AuthService.AuthResult result = authService.refresh("raw");

    assertNull(result.rawRefreshToken());
    assertEquals("access", result.authResponse().accessToken());
    verify(refreshTokenRepository, never()).revokeAllByFamilyId(any());
  }

  @Test
  void refresh_withTokenReplacedLongAgo_revokesTheWholeFamily() {
    RefreshTokenEntity token = replacedToken(Instant.now().minusSeconds(120));
    when(refreshTokenRepository.findByTokenHashForUpdate(any())).thenReturn(Optional.of(token));

    assertThrows(BadCredentialsException.class, () -> authService.refresh("raw"));

    verify(refreshTokenRepository).revokeAllByFamilyId(token.getFamilyId());
  }

  @Test
  void deleteAccount_withWrongPassword_deletesNothing() {
    UserEntity user = user();
    when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
    when(passwordEncoder.matches("wrong", user.getPasswordHash())).thenReturn(false);

    assertThrows(BadRequestException.class, () -> authService.deleteAccount(user.getId(), "wrong"));

    verify(userRepository, never()).delete(any());
  }

  @Test
  void deleteAccount_removesTheUserAndTheirAvatarFile() {
    UserEntity user = user();
    user.setAvatarFilename("avatar.png");
    when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
    when(passwordEncoder.matches("right", user.getPasswordHash())).thenReturn(true);

    authService.deleteAccount(user.getId(), "right");

    verify(userRepository).delete(user);
    verify(avatarStorageService).delete("avatar.png");
  }

  @Test
  void forgotPassword_withinCooldown_sendsNoSecondEmail() {
    UserEntity user = user();
    when(userRepository.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));
    when(passwordResetTokenRepository.existsByUserIdAndCreatedAtAfter(eq(user.getId()), any()))
        .thenReturn(true);

    authService.forgotPassword(user.getEmail());

    verify(mailService, never()).send(any(), any(), any());
  }

  private RefreshTokenEntity replacedToken(Instant replacedAt) {
    RefreshTokenEntity token =
        new RefreshTokenEntity(user(), "hash", Instant.now().plusSeconds(600), UUID.randomUUID());
    token.setRevoked(true);
    token.setReplaced(true);
    token.setReplacedAt(replacedAt);
    return token;
  }

  private UserEntity user() {
    UserEntity user = new UserEntity("person@example.com", "person", "password-hash");
    user.setId(UUID.randomUUID());
    return user;
  }
}
