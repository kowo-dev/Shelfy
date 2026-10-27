package com.shelfy.api.auth;

import com.shelfy.api.auth.dto.AuthResponseDto;
import com.shelfy.api.auth.dto.LoginRequestDto;
import com.shelfy.api.auth.dto.RegisterRequestDto;
import com.shelfy.api.auth.dto.UserResponseDto;
import com.shelfy.api.common.AfterCommit;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.common.mail.MailService;
import com.shelfy.api.federation.ProfilePublisher;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private static final Logger LOG = LoggerFactory.getLogger(AuthService.class);
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final Duration MAIL_COOLDOWN = Duration.ofMinutes(1);
  private static final Duration REFRESH_REUSE_GRACE = Duration.ofSeconds(30);
  private static final String DUMMY_PASSWORD_HASH =
      "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

  private final UserRepository userRepository;
  private final RefreshTokenRepository refreshTokenRepository;
  private final PasswordResetTokenRepository passwordResetTokenRepository;
  private final EmailVerificationTokenRepository emailVerificationTokenRepository;
  private final EmailChangeTokenRepository emailChangeTokenRepository;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final MailService mailService;
  private final AvatarStorageService avatarStorageService;
  private final PasswordResetProperties passwordResetProperties;
  private final EmailVerificationProperties emailVerificationProperties;
  private final EmailChangeProperties emailChangeProperties;
  private final RegistrationProperties registrationProperties;
  private final Duration refreshTokenTtl;
  private final UserResponseMapper userResponseMapper;

  private final ProfilePublisher profilePublisher;

  public AuthService(
      UserRepository userRepository,
      RefreshTokenRepository refreshTokenRepository,
      PasswordResetTokenRepository passwordResetTokenRepository,
      EmailVerificationTokenRepository emailVerificationTokenRepository,
      EmailChangeTokenRepository emailChangeTokenRepository,
      PasswordEncoder passwordEncoder,
      JwtService jwtService,
      JwtProperties jwtProperties,
      MailService mailService,
      AvatarStorageService avatarStorageService,
      PasswordResetProperties passwordResetProperties,
      EmailVerificationProperties emailVerificationProperties,
      EmailChangeProperties emailChangeProperties,
      RegistrationProperties registrationProperties,
      UserResponseMapper userResponseMapper,
      ProfilePublisher profilePublisher) {
    this.profilePublisher = profilePublisher;

    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.passwordResetTokenRepository = passwordResetTokenRepository;
    this.emailVerificationTokenRepository = emailVerificationTokenRepository;
    this.emailChangeTokenRepository = emailChangeTokenRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
    this.mailService = mailService;
    this.avatarStorageService = avatarStorageService;
    this.passwordResetProperties = passwordResetProperties;
    this.emailVerificationProperties = emailVerificationProperties;
    this.emailChangeProperties = emailChangeProperties;
    this.registrationProperties = registrationProperties;
    this.refreshTokenTtl = Duration.ofDays(jwtProperties.refreshTokenExpirationDays());
    this.userResponseMapper = userResponseMapper;
  }

  @Transactional
  public UserResponseDto register(RegisterRequestDto request) {
    if (!registrationProperties.open()) {
      throw new ForbiddenException(
          ErrorCode.REGISTRATION_CLOSED, "Registrations are closed on this instance");
    }
    if (userRepository.existsByEmailIgnoreCase(request.email())) {
      throw new ConflictException(ErrorCode.EMAIL_ALREADY_IN_USE, "Email already in use");
    }
    if (userRepository.existsByUsernameIgnoreCaseAndDomainIsNull(request.username())) {
      throw new ConflictException(ErrorCode.USERNAME_ALREADY_IN_USE, "Username already in use");
    }
    UserEntity user =
        new UserEntity(
            request.email(), request.username(), passwordEncoder.encode(request.password()));
    UserEntity saved = userRepository.save(user);
    if (emailVerificationProperties.required()) {
      sendVerificationEmail(saved);
    }
    return userResponseMapper.toResponse(saved);
  }

  @Transactional
  public AuthResult login(LoginRequestDto request) {
    UserEntity user = userRepository.findByEmailIgnoreCase(request.email()).orElse(null);
    if (user == null) {
      passwordEncoder.matches(request.password(), DUMMY_PASSWORD_HASH);
      throw new BadCredentialsException("Invalid credentials");
    }
    if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      throw new BadCredentialsException("Invalid credentials");
    }
    if (emailVerificationProperties.required() && !user.isEmailVerified()) {
      throw new ForbiddenException(
          ErrorCode.EMAIL_NOT_VERIFIED, "Please verify your email before logging in");
    }
    String accessToken = jwtService.generateAccessToken(user);
    String rawRefreshToken = issueRefreshToken(user);
    return new AuthResult(
        AuthResponseDto.bearer(accessToken, jwtService.accessTokenTtlSeconds()), rawRefreshToken);
  }

  @Transactional
  public AuthResult refresh(String rawRefreshToken) {
    RefreshTokenEntity refreshToken =
        refreshTokenRepository
            .findByTokenHashForUpdate(hash(rawRefreshToken))
            .filter(token -> token.getExpiresAt().isAfter(Instant.now()))
            .orElseThrow(() -> new BadCredentialsException("Invalid or expired refresh token"));
    if (refreshToken.isRevoked()) {
      boolean parallelRefresh =
          refreshToken.getReplacedAt() != null
              && refreshToken.getReplacedAt().isAfter(Instant.now().minus(REFRESH_REUSE_GRACE));
      if (parallelRefresh && refreshToken.isReplaced()) {
        return new AuthResult(
            AuthResponseDto.bearer(
                jwtService.generateAccessToken(refreshToken.getUser()),
                jwtService.accessTokenTtlSeconds()),
            null);
      }
      if (refreshToken.isReplaced()) {
        refreshTokenRepository.revokeAllByFamilyId(refreshToken.getFamilyId());
      }
      throw new BadCredentialsException("Invalid or expired refresh token");
    }
    refreshToken.setRevoked(true);
    refreshToken.setReplaced(true);
    refreshToken.setReplacedAt(Instant.now());
    refreshTokenRepository.save(refreshToken);

    String accessToken = jwtService.generateAccessToken(refreshToken.getUser());
    String newRefreshToken = issueRefreshToken(refreshToken.getUser(), refreshToken.getFamilyId());
    return new AuthResult(
        AuthResponseDto.bearer(accessToken, jwtService.accessTokenTtlSeconds()), newRefreshToken);
  }

  @Transactional
  public void logout(String rawRefreshToken) {
    refreshTokenRepository
        .findByTokenHash(hash(rawRefreshToken))
        .ifPresent(
            token -> {
              refreshTokenRepository.revokeAllByFamilyId(token.getFamilyId());
            });
  }

  public UserResponseDto getCurrentUser(UUID userId) {
    return userResponseMapper.toResponse(getUser(userId));
  }

  @Transactional
  public void deleteAccount(UUID userId, String password) {
    UserEntity user = getUser(userId);
    if (!passwordEncoder.matches(password, user.getPasswordHash())) {
      throw new BadRequestException(ErrorCode.INVALID_CREDENTIALS, "Invalid password");
    }
    String avatarFilename = user.getAvatarFilename();
    profilePublisher.deleting(user.getId());
    userRepository.delete(user);
    userRepository.flush();
    avatarStorageService.delete(avatarFilename);
  }

  @Transactional
  public void forgotPassword(String email) {
    userRepository
        .findByEmailIgnoreCase(email)
        .filter(
            user ->
                !passwordResetTokenRepository.existsByUserIdAndCreatedAtAfter(
                    user.getId(), Instant.now().minus(MAIL_COOLDOWN)))
        .ifPresent(
            user -> {
              String rawToken = generateRawToken();
              Instant expiresAt =
                  Instant.now()
                      .plus(Duration.ofMinutes(passwordResetProperties.expirationMinutes()));
              passwordResetTokenRepository.save(
                  new PasswordResetTokenEntity(user, hash(rawToken), expiresAt));
              String resetLink = tokenFragmentUrl(passwordResetProperties.resetUrl(), rawToken);
              sendAfterCommit(
                  user,
                  user.getEmail(),
                  "password reset",
                  "Reset your Shelfy password",
                  "We received a request to reset your Shelfy password.\n\n"
                      + "Click the link below to choose a new password. This link expires in "
                      + passwordResetProperties.expirationMinutes()
                      + " minutes.\n\n"
                      + resetLink
                      + "\n\nIf you didn't request this, you can safely ignore this email.");
            });
  }

  @Transactional
  public void verifyEmail(String rawToken) {
    EmailVerificationTokenEntity verificationToken =
        emailVerificationTokenRepository
            .findByTokenHash(hash(rawToken))
            .filter(token -> !token.isUsed())
            .filter(token -> token.getExpiresAt().isAfter(Instant.now()))
            .orElseThrow(
                () ->
                    new BadRequestException(
                        ErrorCode.EMAIL_VERIFICATION_TOKEN_INVALID,
                        "Invalid or expired verification link"));

    UserEntity user = verificationToken.getUser();
    user.setEmailVerified(true);
    userRepository.save(user);

    verificationToken.setUsed(true);
    emailVerificationTokenRepository.save(verificationToken);
  }

  @Transactional
  public void resendVerificationEmail(String email) {
    userRepository
        .findByEmailIgnoreCase(email)
        .filter(user -> !user.isEmailVerified())
        .filter(
            user ->
                !emailVerificationTokenRepository.existsByUserIdAndCreatedAtAfter(
                    user.getId(), Instant.now().minus(MAIL_COOLDOWN)))
        .ifPresent(this::sendVerificationEmail);
  }

  private void sendVerificationEmail(UserEntity user) {
    String rawToken = generateRawToken();
    Instant expiresAt =
        Instant.now().plus(Duration.ofMinutes(emailVerificationProperties.expirationMinutes()));
    emailVerificationTokenRepository.save(
        new EmailVerificationTokenEntity(user, hash(rawToken), expiresAt));
    String verifyLink = tokenFragmentUrl(emailVerificationProperties.verifyUrl(), rawToken);
    sendAfterCommit(
        user,
        user.getEmail(),
        "verification",
        "Confirm your Shelfy account",
        "Welcome to Shelfy! Please confirm your email address to activate your account.\n\n"
            + "Click the link below to verify your email. This link expires in "
            + emailVerificationProperties.expirationMinutes()
            + " minutes.\n\n"
            + verifyLink
            + "\n\nIf you didn't create this account, you can safely ignore this email.");
  }

  @Transactional
  public void requestEmailChange(UUID userId, String newEmail) {
    UserEntity user = getUser(userId);
    if (user.getEmail().equalsIgnoreCase(newEmail)) {
      throw new BadRequestException(
          ErrorCode.EMAIL_ALREADY_IN_USE, "This is already your current email address");
    }
    if (userRepository.existsByEmailIgnoreCase(newEmail)) {
      throw new ConflictException(ErrorCode.EMAIL_ALREADY_IN_USE, "Email already in use");
    }

    emailChangeTokenRepository.markAllUsedByUserId(userId);

    String rawToken = generateRawToken();
    Instant expiresAt =
        Instant.now().plus(Duration.ofMinutes(emailChangeProperties.expirationMinutes()));
    emailChangeTokenRepository.save(
        new EmailChangeTokenEntity(user, newEmail, hash(rawToken), expiresAt));
    String confirmLink = tokenFragmentUrl(emailChangeProperties.confirmUrl(), rawToken);
    sendAfterCommit(
        user,
        newEmail,
        "email change confirmation",
        "Confirm your new Shelfy email address",
        "We received a request to change the email address on your Shelfy account to this one.\n\n"
            + "Click the link below to confirm the change. This link expires in "
            + emailChangeProperties.expirationMinutes()
            + " minutes.\n\n"
            + confirmLink
            + "\n\nIf you didn't request this, you can safely ignore this email.");
  }

  @Transactional
  public UserResponseDto confirmEmailChange(String rawToken) {
    EmailChangeTokenEntity changeToken =
        emailChangeTokenRepository
            .findByTokenHash(hash(rawToken))
            .filter(token -> !token.isUsed())
            .filter(token -> token.getExpiresAt().isAfter(Instant.now()))
            .orElseThrow(
                () ->
                    new BadRequestException(
                        ErrorCode.EMAIL_CHANGE_TOKEN_INVALID,
                        "Invalid or expired confirmation link"));

    if (userRepository.existsByEmailIgnoreCase(changeToken.getNewEmail())) {
      throw new ConflictException(ErrorCode.EMAIL_ALREADY_IN_USE, "Email already in use");
    }

    UserEntity user = changeToken.getUser();
    user.setEmail(changeToken.getNewEmail());
    userRepository.save(user);

    changeToken.setUsed(true);
    emailChangeTokenRepository.save(changeToken);

    return userResponseMapper.toResponse(user);
  }

  @Transactional
  public void resetPassword(String rawToken, String newPassword) {
    PasswordResetTokenEntity resetToken =
        passwordResetTokenRepository
            .findByTokenHash(hash(rawToken))
            .filter(token -> !token.isUsed())
            .filter(token -> token.getExpiresAt().isAfter(Instant.now()))
            .orElseThrow(
                () ->
                    new BadRequestException(
                        ErrorCode.PASSWORD_RESET_TOKEN_INVALID, "Invalid or expired reset token"));

    UserEntity user = resetToken.getUser();
    user.setPasswordHash(passwordEncoder.encode(newPassword));
    userRepository.save(user);

    refreshTokenRepository.revokeAllByUserId(user.getId());
    passwordResetTokenRepository.markAllUsedByUserId(user.getId());
  }

  private UserEntity getUser(UUID userId) {
    return userRepository
        .findById(userId)
        .orElseThrow(
            () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
  }

  private String issueRefreshToken(UserEntity user) {
    return issueRefreshToken(user, UUID.randomUUID());
  }

  private String issueRefreshToken(UserEntity user, UUID familyId) {
    String rawToken = generateRawToken();
    RefreshTokenEntity refreshToken =
        new RefreshTokenEntity(user, hash(rawToken), Instant.now().plus(refreshTokenTtl), familyId);
    refreshTokenRepository.save(refreshToken);
    return rawToken;
  }

  private String generateRawToken() {
    byte[] randomBytes = new byte[32];
    SECURE_RANDOM.nextBytes(randomBytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
  }

  private void sendAfterCommit(
      UserEntity user, String to, String purpose, String subject, String body) {
    AfterCommit.run(
        () -> {
          try {
            mailService.send(to, subject, body);
          } catch (RuntimeException e) {
            LOG.error("Failed to send {} email for userId={}", purpose, user.getId(), e);
          }
        });
  }

  private String tokenFragmentUrl(String baseUrl, String token) {
    return baseUrl + "#token=" + token;
  }

  private String hash(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(hashed);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 not available", e);
    }
  }

  public record AuthResult(AuthResponseDto authResponse, String rawRefreshToken) {}
}
